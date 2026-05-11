import type { Hono } from "hono";
import { handlePaymentNotify } from "../../modules/payment/service";
import { logger } from "../../lib/logger";

function normalizeNotifyPayload(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .filter(([key, value]) => key && value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]),
  );
}

async function readNotifyPayload(c: any): Promise<Record<string, string>> {
  const rawBody = (await c.req.text()).trim();
  if (!rawBody) return {};

  const contentType = c.req.header("content-type") || "";
  if (contentType.includes("application/json") || rawBody.startsWith("{")) {
    return normalizeNotifyPayload(JSON.parse(rawBody));
  }

  return Object.fromEntries(new URLSearchParams(rawBody).entries());
}

export function registerBepusdtRoutes(app: Hono) {
  app.post("/api/payments/bepusdt/notify", async (c) => {
    try {
      const payload = await readNotifyPayload(c);
      const universalContext = (c as any).get("universalContext") as { prisma: import("../../generated/prisma/client").PrismaClient };
      if (!universalContext?.prisma) {
        logger.error("Missing prisma for bepusdt notify", {
          event: "payment.notify.context_missing",
          provider: "BEPUSDT",
          source: "notify",
          payload,
        });
        return c.text("fail", 500);
      }
      const result = await handlePaymentNotify("BEPUSDT", payload, universalContext.prisma, "notify");
      return c.text(result.ok ? "success" : "fail");
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), {
        event: "payment.notify.route_exception",
        provider: "BEPUSDT",
        source: "notify",
      });
      return c.text("fail", 400);
    }
  });
}
