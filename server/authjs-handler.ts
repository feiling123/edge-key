import { Auth, type AuthConfig, createActionURL, setEnvDefaults } from "@auth/core";
import { CredentialsSignin } from "@auth/core/errors";
import CredentialsProvider from "@auth/core/providers/credentials";
import type { Session } from "@auth/core/types";
import { enhance, type UniversalHandler, type UniversalMiddleware } from "@universal-middleware/core";
import { PrismaClient } from "../generated/prisma/client";
import { randomBytes } from "node:crypto";
import { internalServerError, rateLimitError } from "../lib/app-error";
import { logger } from "../lib/logger";
import { adminPublicPath } from "../lib/admin-path";
import { getClientIpFromRequest } from "../lib/request-context";
import { verifyAdminPassword, hashAdminPassword } from "../modules/auth/crypto";
import { notifyAdminLogin } from "../modules/notify/service";

const ADMIN_ROLE = "admin" as const;
const AUTH_SECRET_KEY = "auth_secret";
const loginAttemptStore = new Map<string, { count: number; expiresAt: number }>();
let cachedGeneratedAuthSecret: string | null = null;

interface AuthContext {
  prisma: PrismaClient;
  session?: Session | null;
}

interface AuthRequestMeta {
  clientIp?: string;
  siteUrl?: string;
}

async function getAuthSecret(prisma: PrismaClient) {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();

  if (!secret) {
    return getGeneratedAuthSecret(prisma);
  }

  return secret;
}

async function getGeneratedAuthSecret(prisma: PrismaClient) {
  if (cachedGeneratedAuthSecret) {
    return cachedGeneratedAuthSecret;
  }

  const existing = await prisma.runtimeSecret.findUnique({
    where: { key: AUTH_SECRET_KEY },
  });
  if (existing?.value) {
    cachedGeneratedAuthSecret = existing.value;
    return existing.value;
  }

  const value = randomBytes(32).toString("hex");
  try {
    const created = await prisma.runtimeSecret.create({
      data: {
        key: AUTH_SECRET_KEY,
        value,
      },
    });
    cachedGeneratedAuthSecret = created.value;
    logger.warn("auth.secret.generated_from_d1", {
      event: "auth.secret.generated_from_d1",
      message: "AUTH_SECRET is not configured; generated a per-install secret in D1.",
    });
    return created.value;
  } catch (error: any) {
    if (error?.code === "P2002") {
      const record = await prisma.runtimeSecret.findUnique({
        where: { key: AUTH_SECRET_KEY },
      });
      if (record?.value) {
        cachedGeneratedAuthSecret = record.value;
        return record.value;
      }
    }
    throw internalServerError("认证密钥初始化失败", "AUTH_SECRET_INIT_FAILED", {
      cause: error,
      details: {
        table: "RuntimeSecret",
        key: AUTH_SECRET_KEY,
      },
    });
  }
}

function getLoginRateLimitConfig() {
  // 登录尝试次数限制配置,默认 10 次/10 分钟
  const maxAttempts = Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS || 10);
  const windowMs = Number(process.env.ADMIN_LOGIN_WINDOW_MS || 10 * 60 * 1000);

  return {
    maxAttempts: Number.isFinite(maxAttempts) ? maxAttempts : 10,
    windowMs: Number.isFinite(windowMs) ? windowMs : 10 * 60 * 1000,
  };
}

function isCredentialsCallbackRequest(request: Request) {
  const url = new URL(request.url);
  return request.method === "POST" && url.pathname.endsWith("/api/auth/callback/credentials");
}

function isRateLimited(request: Request) {
  const { maxAttempts, windowMs } = getLoginRateLimitConfig();
  const now = Date.now();
  const key = getClientIpFromRequest(request);
  const current = loginAttemptStore.get(key);

  if (!current || current.expiresAt <= now) {
    loginAttemptStore.set(key, { count: 1, expiresAt: now + windowMs });
    return false;
  }

  current.count += 1;
  loginAttemptStore.set(key, current);
  return current.count > maxAttempts;
}

async function findAdminByCredentials(prisma: PrismaClient, username: string, password: string) {
  const admin = await prisma.admin.findUnique({
    where: { username },
  });

  if (!admin || admin.status !== "ACTIVE") {
    return null;
  }

  const valid = await verifyAdminPassword(password, admin.passwordHash);
  if (!valid) {
    return null;
  }

  // 旧 SHA-256 哈希自动升级为 bcrypt
  if (!admin.passwordHash.startsWith("$2b$") && !admin.passwordHash.startsWith("$2a$")) {
    try {
      const newHash = await hashAdminPassword(password);
      await prisma.admin.update({ where: { username }, data: { passwordHash: newHash } });
    } catch (e) {
      logger.error("auth.password_upgrade.failed", { error: e });
      const err = new CredentialsSignin("哈希字符串升级失败，请参考官网文档重置管理员密码");
      err.code = "password_upgrade_failed";
      throw err;
    }
  }

  return {
    id: String(admin.id),
    name: admin.nickname || admin.username,
    username: admin.username,
    role: ADMIN_ROLE,
  };
}

async function createAuthjsConfig(prisma: PrismaClient, requestMeta: AuthRequestMeta = {}) {
  return {
    basePath: "/api/auth",
    trustHost: true,
    secret: await getAuthSecret(prisma),
    session: {
      strategy: "jwt",
    },
    pages: {
      signIn: `${adminPublicPath(process.env)}/login`,
    },
    providers: [
      CredentialsProvider({
        name: "Credentials",
        credentials: {
          username: { label: "Username", type: "text", placeholder: "admin" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const usernameRaw = credentials?.username;
          const passwordRaw = credentials?.password;
          const username = typeof usernameRaw === "string" ? usernameRaw.trim() : "";
          const password = typeof passwordRaw === "string" ? passwordRaw : "";

          if (!username || !password) {
            return null;
          }

          return findAdminByCredentials(prisma, username, password);
        },
      }),
    ],
    events: {
      async signIn({ user }) {
        const signedUser = user as { username?: unknown; name?: unknown; role?: unknown };
        if (signedUser.role !== ADMIN_ROLE) return;
        try {
          await notifyAdminLogin({
            prisma,
            username: typeof signedUser.username === "string"
              ? signedUser.username
              : (typeof signedUser.name === "string" ? signedUser.name : "admin"),
            clientIp: requestMeta.clientIp,
            siteUrl: requestMeta.siteUrl,
          });
        } catch (error) {
          logger.warn(error instanceof Error ? error : new Error(String(error)), {
            event: "telegram.admin_login.failed",
          });
        }
      },
    },
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id;
          token.username = user.username;
          token.role = user.role;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = typeof token.id === "string" ? token.id : undefined;
          session.user.username = typeof token.username === "string" ? token.username : undefined;
          session.user.role = token.role === ADMIN_ROLE ? ADMIN_ROLE : undefined;
        }
        return session;
      },
    },
  } satisfies Omit<AuthConfig, "raw">;
}

/**
 * Retrieve Auth.js session from Request
 */
export async function getSession(req: Request, config: Omit<AuthConfig, "raw">): Promise<Session | null> {
  setEnvDefaults(process.env, config);
  const requestURL = new URL(req.url);
  const url = createActionURL("session", requestURL.protocol, req.headers, process.env, config);

  const response = await Auth(new Request(url, { headers: { cookie: req.headers.get("cookie") ?? "" } }), config);

  const { status = 200 } = response;

  const data = await response.json();

  if (!data || !Object.keys(data).length) return null;
  if (status === 200) return data as Session;
  throw internalServerError(typeof data === "object" && "message" in data ? (data.message as string) : undefined, "AUTH_SESSION_REQUEST_FAILED", {
    details: {
      status,
    },
  });
}

// Note: You can directly define a server middleware instead of defining a Universal Middleware. (You can remove @universal-middleware/* — Vike's scaffolder uses it only to simplify its internal logic, see https://github.com/vikejs/vike/discussions/3116)
/**
 * Add Auth.js session to the context.
 * @link {@see https://authjs.dev/getting-started/session-management/get-session}
 */
export const authjsSessionMiddleware: UniversalMiddleware = enhance(
  // The context we add here is automatically merged into pageContext
  async (request, context) => {
    try {
      const authContext = context as unknown as AuthContext;
      const config = await createAuthjsConfig(authContext.prisma);
      return {
        ...authContext,
        // Sets pageContext.session
        session: await getSession(request, config),
      };
    } catch (error) {
      logger.warn(error instanceof Error ? error : new Error(String(error)), {
        event: "auth.session.middleware_failed",
      });
      return {
        ...context,
        session: null,
      };
    }
  },
  {
    name: "my-app:authjs-middleware",
    immutable: false,
  },
);

// Note: You can directly define a server middleware instead of defining a Universal Middleware. (You can remove @universal-middleware/* — Vike's scaffolder uses it only to simplify its internal logic, see https://github.com/vikejs/vike/discussions/3116)
/**
 * Auth.js route
 * @link {@see https://authjs.dev/getting-started/installation}
 **/
export const authjsHandler = enhance(
  async (request, context) => {
    if (isCredentialsCallbackRequest(request) && isRateLimited(request)) {
      const error = rateLimitError("Too Many Requests", "AUTH_RATE_LIMITED");
      return new Response(error.message, {
        status: error.statusCode,
      });
    }

    const authContext = context as unknown as AuthContext;
    const url = new URL(request.url);
    return Auth(request, await createAuthjsConfig(authContext.prisma, {
      clientIp: getClientIpFromRequest(request),
      siteUrl: url.origin,
    }));
  },
  {
    name: "my-app:authjs-handler",
    path: "/api/auth/**",
    method: ["GET", "POST"],
    immutable: false,
  },
) satisfies UniversalHandler;
