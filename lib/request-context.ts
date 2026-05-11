import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = {
  requestId: string;
  method?: string;
  path?: string;
  url?: string;
  origin?: string;
  clientIp?: string;
  cfRay?: string;
};

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, callback: () => T) {
  return requestContextStorage.run(context, callback);
}

export function getRequestContext() {
  return requestContextStorage.getStore() ?? null;
}

export function getClientIpFromRequest(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return request.headers.get("cf-connecting-ip") || forwarded?.split(",")[0]?.trim() || "unknown";
}

export function createRequestContext(request: Request): RequestContext {
  const url = new URL(request.url);
  return {
    requestId: request.headers.get("x-request-id") || crypto.randomUUID(),
    method: request.method,
    path: url.pathname,
    url: request.url,
    origin: url.origin,
    clientIp: getClientIpFromRequest(request),
    cfRay: request.headers.get("cf-ray") || undefined,
  };
}
