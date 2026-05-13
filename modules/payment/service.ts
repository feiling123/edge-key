import { getContext } from "telefunc";
import type { PrismaClient } from "../../generated/prisma/client";
import { badRequestError, conflictError, notFoundError } from "../../lib/app-error";
import { logger } from "../../lib/logger";
import { notifyOrderPaid } from "../notify/service";
import { getSiteSetting } from "../site/service";
import { createPaymentLogRecord } from "./repository";
import type { PaymentProvider, PaymentConfigValue } from "./types";
import { defaultPaymentConfigs, getPaymentConfigs } from "./config";
import { createBepusdtAdapter } from "./bepusdt";
import { createEpayAdapter } from "./epay";
import { createAlipayAdapter, queryAlipayTrade } from "./alipay";
import { createStripeAdapter } from "./stripe";
import { deliverOrder } from "../delivery/service";
import { findOrderRecord, updateOrderPayment } from "../order/repository";

export { getPaymentConfigs, listEnabledPaymentMethods, validatePaymentSelection } from "./config";
export { savePaymentConfig } from "./config-admin";

function getPaymentContext() {
  return getContext<{ prisma: PrismaClient }>();
}

function createProviderAdapter(config: PaymentConfigValue) {
  if (config.provider === "BEPUSDT") {
    return createBepusdtAdapter(config);
  }
  if (config.provider === "ALIPAY") {
    return createAlipayAdapter(config);
  }
  if (config.provider === "STRIPE") {
    return createStripeAdapter(config);
  }
  return createEpayAdapter(config);
}

async function getBaseOrigin(prisma: PrismaClient) {
  const site = await getSiteSetting(prisma);
  const baseOrigin = site.siteUrl?.trim().replace(/\/+$/, "") || "";

  if (!baseOrigin) {
    throw badRequestError("站点设置缺少网站地址", "SITE_URL_MISSING");
  }

  return baseOrigin;
}

function applyUrlTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

function resolveCallbackUrl(baseOrigin: string, configuredValue: string | undefined, fallbackValue: string, templateValues?: Record<string, string>) {
  const rawValue = (configuredValue?.trim() || fallbackValue).trim();
  const templatedValue = applyUrlTemplate(rawValue, templateValues ?? {});

  if (/^https?:\/\//i.test(templatedValue)) {
    return templatedValue;
  }

  const normalizedPath = templatedValue.startsWith("/") ? templatedValue : `/${templatedValue}`;
  return `${baseOrigin}${normalizedPath}`;
}

export async function createPaymentForOrder(orderNo: string, prisma?: PrismaClient) {
  const client = prisma ?? getPaymentContext().prisma;
  const order = await client.order.findUnique({
    where: { orderNo },
  });

  if (!order) {
    throw notFoundError("订单不存在", "ORDER_NOT_FOUND");
  }

  if (order.paymentStatus === "PAID") {
    throw conflictError("订单已支付", "ORDER_ALREADY_PAID");
  }

  const configs = await getPaymentConfigs(client);
  const config = configs[order.paymentProvider];

  if (!config.isEnabled) {
    throw conflictError(`${config.name} 当前未启用`, "PAYMENT_PROVIDER_DISABLED");
  }

  if (!config.baseUrl) {
    throw badRequestError(`${config.name} 缺少网关地址配置`, "PAYMENT_PROVIDER_BASE_URL_MISSING");
  }

  const adapter = createProviderAdapter(config);
  const baseOrigin = await getBaseOrigin(client);
  const templateValues = {
    orderNo: order.orderNo,
    token: encodeURIComponent(order.queryToken),
  };
  const notifyUrl = resolveCallbackUrl(
    baseOrigin,
    config.notifyUrl,
    defaultPaymentConfigs[order.paymentProvider as PaymentProvider]?.notifyUrl ?? "/api/payments/notify",
  );
  const returnUrl = resolveCallbackUrl(
    baseOrigin,
    config.returnUrl,
    `/order/{orderNo}?token={token}`,
    templateValues,
  );

  const result = await adapter.createPayment({
    orderNo: order.orderNo,
    amount: order.amount,
    productName: order.productNameSnapshot,
    notifyUrl,
    returnUrl,
    paymentChannel: order.paymentChannel ?? undefined,
  });

  if (result.paymentOrderNo) {
    await client.order.update({
      where: { orderNo: order.orderNo },
      data: {
        paymentOrderNo: result.paymentOrderNo,
      },
    });
  }

  await createPaymentLogRecord(client, {
    orderId: order.id,
    provider: order.paymentProvider,
    orderNo: order.orderNo,
    paymentOrderNo: result.paymentOrderNo,
    eventType: "CREATE_PAYMENT",
    rawPayload: JSON.stringify(result.raw ?? result),
    verifyStatus: "PENDING",
    message: "payment created",
  });

  return result;
}

function formatNotifyLogMessage(source: string, message?: string | null, status?: string | null) {
  const base = `source=${source}, ${message || "unknown"}`;
  return status ? `${base}; status=${status}` : base;
}

function redactSensitiveValue(value: string) {
  if (value.length <= 8) {
    return "***";
  }

  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function sanitizePaymentPayload(payload?: Record<string, unknown>) {
  if (!payload) {
    return undefined;
  }

  const sensitivePattern = /(md5|sign|signature|key|secret|appsecret|密钥)/i;
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (!sensitivePattern.test(key)) {
        return [key, value];
      }

      return [key, redactSensitiveValue(String(value ?? ""))];
    }),
  );
}

async function createNotifyLog(prisma: PrismaClient, input: {
  orderId?: number;
  provider: PaymentProvider;
  orderNo?: string;
  paymentOrderNo?: string;
  eventType?: string;
  rawPayload: string;
  verifyStatus: "PENDING" | "VERIFIED" | "FAILED";
  source: string;
  message?: string | null;
  status?: string | null;
}) {
  await createPaymentLogRecord(prisma, {
    orderId: input.orderId,
    provider: input.provider,
    orderNo: input.orderNo,
    paymentOrderNo: input.paymentOrderNo,
    eventType: input.eventType ?? "NOTIFY",
    rawPayload: input.rawPayload,
    verifyStatus: input.verifyStatus,
    message: formatNotifyLogMessage(input.source, input.message, input.status),
  });
}

function writePaymentNotifyDiagnostic(input: {
  provider: PaymentProvider;
  source: string;
  reason: string;
  payload?: Record<string, unknown>;
  orderNo?: string;
  error?: unknown;
}) {
  const context = {
    event: "payment.notify.diagnostic",
    provider: input.provider,
    source: input.source,
    reason: input.reason,
    orderNo: input.orderNo,
    payload: sanitizePaymentPayload(input.payload),
  };

  if (input.error instanceof Error) {
    logger.error(input.error, context);
    return;
  }

  logger.error(input.reason, {
    ...context,
    error: input.error ? String(input.error) : undefined,
  });
}

export async function queryAlipayPayment(orderNo: string, prisma?: PrismaClient) {
  const client = prisma ?? getPaymentContext().prisma;
  const order = await findOrderRecord(client, orderNo);
  if (!order) throw notFoundError("订单不存在", "ORDER_NOT_FOUND");
  if (order.paymentStatus === "PAID") {
    if (order.deliveryStatus !== "DELIVERED") {
      try {
        await deliverOrder(client, orderNo);
      } catch (error) {
        logger.error(error instanceof Error ? error : String(error), {
          event: "payment.query_paid_delivery_recovery.failed",
          orderNo,
        });
      }
    }
    return { alreadyPaid: true };
  }

  const configs = await getPaymentConfigs(client);
  const config = configs["ALIPAY"];
  const result = await queryAlipayTrade(config, orderNo);

  if (result.isPaid) {
    const updated = await updateOrderPayment(client, orderNo, {
      paymentOrderNo: result.tradeNo,
      status: "PAID",
      paymentStatus: "PAID",
      paidAt: new Date(),
    });
    if (updated) {
      await createPaymentLogRecord(client, {
        orderId: order.id,
        provider: "ALIPAY",
        orderNo,
        paymentOrderNo: result.tradeNo,
        eventType: "QUERY_PAID",
        rawPayload: JSON.stringify(result),verifyStatus: "VERIFIED",
        message: "paid via query",
      });
      try {
        await deliverOrder(client, orderNo);
      } catch {}
    }
  }

  return { alreadyPaid: false, isPaid: result.isPaid };
}

export async function handlePaymentNotify(
  provider: PaymentProvider,
  payload: Record<string, string>,
  prisma: PrismaClient,
  source: string,
) {
  const configs = await getPaymentConfigs(prisma);
  const adapter = createProviderAdapter(configs[provider]);
  const verified = await adapter.verifyNotify(payload);
  const order = verified.orderNo ? await findOrderRecord(prisma, verified.orderNo) : null;
  const rawPayload = JSON.stringify(verified.raw);

  if (!verified.isValid) {
    await createNotifyLog(prisma, {
      orderId: order?.id,
      provider,
      orderNo: verified.orderNo,
      paymentOrderNo: verified.paymentOrderNo,
      rawPayload,
      verifyStatus: "FAILED",
      source,
      message: verified.message,
      status: verified.status,
    });
    writePaymentNotifyDiagnostic({
      provider,
      source,
      reason: verified.message || "invalid notify",
      orderNo: verified.orderNo,
      payload,
    });
    return {
      ok: false,
      status: verified.status,
      message: verified.message || "invalid notify",
    };
  }

  if (!verified.orderNo) {
    await createNotifyLog(prisma, {
      provider,
      paymentOrderNo: verified.paymentOrderNo,
      rawPayload,
      verifyStatus: "FAILED",
      source,
      message: "missing orderNo",
      status: verified.status,
    });
    writePaymentNotifyDiagnostic({
      provider,
      source,
      reason: "missing orderNo",
      payload,
    });
    return {
      ok: false,
      status: verified.status,
      message: verified.message || "missing orderNo",
    };
  }

  if (!order) {
    await createNotifyLog(prisma, {
      provider,
      orderNo: verified.orderNo,
      paymentOrderNo: verified.paymentOrderNo,
      rawPayload,
      verifyStatus: "FAILED",
      source,
      message: "missing order",
      status: verified.status,
    });
    writePaymentNotifyDiagnostic({
      provider,
      source,
      reason: "missing order",
      orderNo: verified.orderNo,
      payload,
    });
    return {
      ok: false,
      status: verified.status,
      message: "missing order",
    };
  }

  if (verified.amount !== undefined && verified.amount !== order.amount) {
    await createNotifyLog(prisma, {
      orderId: order.id,
      provider,
      orderNo: verified.orderNo,
      paymentOrderNo: verified.paymentOrderNo,
      eventType: "NOTIFY_AMOUNT_MISMATCH",
      rawPayload,
      verifyStatus: "FAILED",
      source,
      message: `expected=${order.amount}, actual=${verified.amount}`,
      status: verified.status,
    });

    writePaymentNotifyDiagnostic({
      provider,
      source,
      reason: "amount mismatch",
      orderNo: verified.orderNo,
      payload,
    });

    return {
      ok: false,
      status: "FAILED",
      message: "amount mismatch",
    };
  }

  if (order.paymentStatus === "PAID") {
    if (order.deliveryStatus !== "DELIVERED") {
      try {
        await deliverOrder(prisma, order.orderNo);
      } catch (error) {
        writePaymentNotifyDiagnostic({
          provider,
          source,
          reason: "already paid delivery recovery failed",
          orderNo: order.orderNo,
          payload,
          error,
        });
      }
    }

    await createNotifyLog(prisma, {
      orderId: order.id,
      provider,
      orderNo: verified.orderNo,
      paymentOrderNo: verified.paymentOrderNo,
      rawPayload,
      verifyStatus: "VERIFIED",
      source,
      message: "already paid",
      status: verified.status,
    });

    return {
      ok: true,
      status: verified.status,
      message: "already paid",
    };
  }

  if (verified.status === "PAID") {
    const updated = await updateOrderPayment(prisma, verified.orderNo, {
      paymentOrderNo: verified.paymentOrderNo,
      status: "PAID",
      paymentStatus: "PAID",
      paidAt: new Date(),
    });

    if (!updated) {
      // 已经被并发回调处理过时，仍然补一次幂等发货检查，避免只写入 PAID 但发货未完成的窗口被卡住。
      const latestOrder = await findOrderRecord(prisma, verified.orderNo);
      if (latestOrder?.paymentStatus === "PAID" && latestOrder.deliveryStatus !== "DELIVERED") {
        try {
          await deliverOrder(prisma, latestOrder.orderNo);
        } catch (error) {
          writePaymentNotifyDiagnostic({
            provider,
            source,
            reason: "concurrent paid delivery recovery failed",
            orderNo: latestOrder.orderNo,
            payload,
            error,
          });
        }
      }
      await createNotifyLog(prisma, {
        orderId: latestOrder?.id ?? order.id,
        provider,
        orderNo: verified.orderNo,
        paymentOrderNo: verified.paymentOrderNo,
        rawPayload,
        verifyStatus: "VERIFIED",
        source,
        message: "already paid",
        status: verified.status,
      });
      return {
        ok: true,
        status: "PAID",
        message: "already paid",
      };
    }

    // 先记录首次成功回调，再执行发货，避免并发下后到的回调先写出
    // `already paid`，而首个成功回调的 `ok` 反而更晚落库。
    // 如果订单之前被 auto-close 关闭过（status=CLOSED），在日志中标注重开。
    const reopenNote = order.status === "CLOSED" ? " (reopened from CLOSED)" : "";
    await createNotifyLog(prisma, {
      orderId: order.id,
      provider,
      orderNo: verified.orderNo,
      paymentOrderNo: verified.paymentOrderNo,
      rawPayload,
      verifyStatus: "VERIFIED",
      source,
      message: `ok${reopenNote}`,
      status: verified.status,
    });

    let deliveryError: unknown;
    try {
      await deliverOrder(prisma, verified.orderNo);
    } catch (error) {
      deliveryError = error;
      writePaymentNotifyDiagnostic({
        provider,
        source,
        reason: "delivery failed",
        orderNo: verified.orderNo,
        payload,
        error,
      });
      await createNotifyLog(prisma, {
        orderId: order.id,
        provider,
        orderNo: verified.orderNo,
        paymentOrderNo: verified.paymentOrderNo,
        rawPayload,
        verifyStatus: "VERIFIED",
        source,
        message: "delivery failed",
        status: verified.status,
      });
    }

    try {
      await notifyOrderPaid({
        prisma,
        orderId: order.id,
        orderNo: order.orderNo,
        queryToken: order.queryToken,
        productName: order.productNameSnapshot,
        amount: order.amount,
      });
    } catch (error) {
      logger.error(error instanceof Error ? error : String(error), {
        event: "telegram.order_paid.failed",
        provider,
        orderNo: order.orderNo,
      });
    }

    if (deliveryError) {
      return {
        ok: true,
        status: verified.status,
        message: deliveryError instanceof Error ? `paid, delivery failed: ${deliveryError.message}` : "paid, delivery failed",
      };
    }

    return {
      ok: true,
      status: verified.status,
      message: "ok",
    };
  }

  if (verified.status === "FAILED") {
    await updateOrderPayment(prisma, verified.orderNo, {
      paymentOrderNo: verified.paymentOrderNo,
      status: "FAILED",
      paymentStatus: "FAILED",
      paidAt: null,
    });
  }

  await createNotifyLog(prisma, {
    orderId: order.id,
    provider,
    orderNo: verified.orderNo,
    paymentOrderNo: verified.paymentOrderNo,
    rawPayload,
    verifyStatus: "VERIFIED",
    source,
    message: "ok",
    status: verified.status,
  });

  return {
    ok: true,
    status: verified.status,
    message: "ok",
  };
}
