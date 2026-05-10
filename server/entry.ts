import { authjsHandler, authjsSessionMiddleware } from "./authjs-handler";
import { ensureD1Ready } from "./d1-bootstrap";
import { getPrismaForD1 } from "./prisma-factory";
import { telefuncHandler } from "./telefunc-handler";
import { prismaMiddleware } from "./prisma-middleware";
import { registerApiRoutes } from "./routes";
import { scheduled } from "./scheduled";
import { adminPublicPath, INTERNAL_ADMIN_REWRITE_HEADER, isAdminPath, mapPublicAdminPath, nginx404 } from "../lib/admin-path";
import { createRequestContext, runWithRequestContext } from "../lib/request-context";
import { apply, serve } from "@photonjs/hono";
import { Hono } from "hono";

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const PUBLIC_PAGE_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";
const SENSITIVE_CACHE_CONTROL = "no-store, max-age=0";

/**
 * 创建并配置 Hono 应用实例。
 *
 * Photon 虚拟模块使用（通过 serve() 包装）。
 *
 * 此应用只提供 fetch handler。Cron Trigger 的 scheduled handler
 * 在下方通过 entry.scheduled 挂到 serve() 返回值上。
 */
export function createApp() {
  const app = new Hono();
  const apiApp = new Hono();

  app.use(async (c, next) => {
    const env = c.env as { ADMIN_PATH?: string; AUTH_SECRET?: string; NEXTAUTH_SECRET?: string } | undefined;
    if (env?.ADMIN_PATH) process.env.ADMIN_PATH = String(env.ADMIN_PATH);
    if (env?.AUTH_SECRET) process.env.AUTH_SECRET = String(env.AUTH_SECRET);
    if (env?.NEXTAUTH_SECRET) process.env.NEXTAUTH_SECRET = String(env.NEXTAUTH_SECRET);

    const requestContext = createRequestContext(c.req.raw);
    (c as any).set("requestId", requestContext.requestId);
    (c as any).set("universalContext", {
      requestId: requestContext.requestId,
    } as any);

    await runWithRequestContext(requestContext, async () => {
      await next();
    });

    c.header("x-request-id", requestContext.requestId);
    applyResponseCachePolicy(c);
  });

  app.use("*", async (c, next) => {
    const adminBase = adminPublicPath(c.env as { ADMIN_PATH?: string } | undefined);
    const url = new URL(c.req.url);
    const internalRewrite = c.req.header(INTERNAL_ADMIN_REWRITE_HEADER) === "1";

    if (isAdminPath(url.pathname, adminBase) && !internalRewrite) {
      const mappedUrl = mapPublicAdminPath(url, adminBase);
      const headers = new Headers(c.req.raw.headers);
      headers.set(INTERNAL_ADMIN_REWRITE_HEADER, "1");
      const method = c.req.raw.method.toUpperCase();
      const mappedRequest = new Request(mappedUrl, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : c.req.raw.body,
        redirect: c.req.raw.redirect,
      });
      return app.fetch(mappedRequest, c.env, (c as any).executionCtx);
    }

    if (adminBase !== "/admin" && isAdminPath(url.pathname, "/admin") && !internalRewrite) {
      return nginx404();
    }

    await next();
  });
  // api对外提供接口服务
  // `/api/*` 路由使用独立的 Hono 子应用，原因有两个：
  // 1. API 路由必须先于 `apply(app, [...])` 的页面兜底注册，否则支付回调会落到 SSR 404；
  // 2. API 路由又依赖 Prisma，因此需要在子应用内部单独注入上下文，不能只依赖 `apply()` 里的中间件链。
  //
  // 这样拆分后，结构会更清晰：
  // - `apiApp` 负责所有明确的 `/api/*` 路由及其所需中间件
  // - `apply(app, [...])` 继续负责页面、Auth.js、Telefunc 等通用链路
  apiApp.use("*", async (c, next) => {
    const database = (c.env as { DB?: D1Database } | undefined)?.DB;
    if (database) {
      await ensureD1Ready(database);
      const prisma = getPrismaForD1(database);

      (c as any).set("universalContext", {
        ...(c as any).get("universalContext"),
        prisma,
      });
    }

    await next();
  });

  registerApiRoutes(apiApp);

  // 先挂载 API 子应用，再挂页面/通用处理链，避免 `/api/*` 被页面兜底吞掉。
  app.route("/", apiApp);

  apply(app, [
    // Add Prisma instance to context
    prismaMiddleware,

    // Append Auth.js session to context
    authjsSessionMiddleware,

    // Auth.js route. See https://authjs.dev/getting-started/installation
    authjsHandler,

    // Telefunc route. See https://telefunc.com
    telefuncHandler,
  ]);

  return app;
}

// Photon 虚拟模块入口 把 scheduled 挂到 serve() 的返回值上，Photon 做 { ...entry } spread 时
// 会自动包含它，最终 CF Workers 的 default export 上就有了 scheduled。
// export { scheduled } 防止 Rollup tree-shake 掉未被直接调用的函数。
const entry = serve(createApp(), { port }) as unknown as Record<string, unknown>;
entry.scheduled = scheduled;
export default entry;
export { scheduled };

function applyResponseCachePolicy(c: any) {
  const url = new URL(c.req.url);
  const pathname = url.pathname;
  const method = c.req.raw.method.toUpperCase();
  const response = c.res as Response | undefined;
  const adminBase = adminPublicPath(c.env as { ADMIN_PATH?: string } | undefined);

  if (!response || response.status !== 200) return;

  if (isSensitivePath(pathname, adminBase)) {
    response.headers.set("Cache-Control", SENSITIVE_CACHE_CONTROL);
    return;
  }

  if (method !== "GET" && method !== "HEAD") return;
  if (!isPublicCdnPage(pathname)) return;
  if (c.req.header("cookie") || c.req.header("authorization")) return;
  if (response.headers.has("set-cookie")) return;

  response.headers.set("Cache-Control", PUBLIC_PAGE_CACHE_CONTROL);
  response.headers.set("CDN-Cache-Control", PUBLIC_PAGE_CACHE_CONTROL);
  response.headers.set("Vary", mergeVaryHeader(response.headers.get("Vary"), "Accept-Encoding"));
}

function isPublicCdnPage(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/blog" ||
    pathname.startsWith("/blog/") ||
    pathname.startsWith("/product/") ||
    pathname === "/notice" ||
    pathname === "/about"
  );
}

function isSensitivePath(pathname: string, adminBase: string) {
  return (
    isAdminPath(pathname, adminBase) ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_telefunc") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/order/") ||
    pathname === "/query"
  );
}

function mergeVaryHeader(current: string | null, value: string) {
  if (!current) return value;
  const parts = new Set(current.split(",").map((part) => part.trim()).filter(Boolean));
  parts.add(value);
  return [...parts].join(", ");
}
