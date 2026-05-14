import { getContext } from "telefunc";
import type { PaymentProvider } from "../payment/types";
import type { PrismaClient } from "../../generated/prisma/client";
import { badRequestError, conflictError, notFoundError } from "../../lib/app-error";
import { validateOrderInput } from "../../lib/validators/order";
import { getAdminContext, logAdminOperation } from "../auth/service";
import { getAdminProductById } from "../catalog/service";
import { getPaymentConfig } from "../payment/config";
import { createPaymentForOrder, handlePaymentNotify, validatePaymentSelection } from "../payment/service";
import { deliverOrder } from "../delivery/service";
import { closeOrderRecord, createOrderRecord, deleteOrderRecords, findOrderById, findOrderWithProduct, listOrderRecords } from "./repository";
import { generateOrderNo, generateQueryToken } from "./number";
import { logger } from "../../lib/logger";
import { getRequestContext } from "../../lib/request-context";
import { notifyOrderDeleted } from "../notify/service";
import { getFullSiteSetting } from "../site/service";
import { validateTurnstileToken } from "../../lib/utils/turnstile";
import { validateOrderToken } from "../../lib/utils/order-token";

function getOrderContext() {
  return getContext<{ prisma: PrismaClient }>();
}

function pickEpayReturnPayload(searchParams?: Record<string, string | undefined>) {
  const allowedKeys = new Set([
    "pid",
    "trade_no",
    "out_trade_no",
    "type",
    "name",
    "money",
    "trade_status",
    "param",
    "sign",
    "sign_type",
  ]);

  return Object.fromEntries(
    Object.entries(searchParams ?? {}).filter(([key, value]) => allowedKeys.has(key) && typeof value === "string" && value.length > 0),
  ) as Record<string, string>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type OrderQueryOptions = {
  waitForSyncMs?: number;
  pollIntervalMs?: number;
  waitForDeliveryMs?: number;
  deliveryPollIntervalMs?: number;
  deliveryRecoveryAfterMs?: number;
};

const PAYMENT_SYNC_WAIT_MAX_MS = 3200;
const DELIVERY_SYNC_WAIT_MAX_MS = 4200;

function getDefaultPaymentProviderName(provider: string) {
  switch (provider) {
    case "EPAY":
      return "易支付";
    case "BEPUSDT":
      return "BEpusdt";
    case "ALIPAY":
      return "支付宝";
    case "STRIPE":
      return "Stripe";
    default:
      return "支付方式";
  }
}

function formatPaymentProviderDisplayName(provider: string, providerName: string, paymentChannel?: string | null) {
  const channel = paymentChannel?.trim();
  if (provider === "BEPUSDT" && channel) {
    return `${providerName} / ${channel}`;
  }
  return providerName;
}

async function getPaymentProviderDisplayName(client: PrismaClient, provider: string, paymentChannel?: string | null) {
  try {
    const config = await getPaymentConfig(provider as PaymentProvider, client);
    const providerName = config?.name?.trim() || getDefaultPaymentProviderName(provider);
    return formatPaymentProviderDisplayName(provider, providerName, paymentChannel);
  } catch (error) {
    logger.warn("order.payment_provider_name.resolve_failed", {
      event: "order.payment_provider_name.resolve_failed",
      provider,
      paymentChannel,
      error: error instanceof Error ? error.message : String(error),
    });
    return formatPaymentProviderDisplayName(provider, getDefaultPaymentProviderName(provider), paymentChannel);
  }
}

async function waitForPaymentSync(
  client: PrismaClient,
  orderNo: string,
  queryToken: string,
  currentOrder: NonNullable<Awaited<ReturnType<typeof findOrderWithProduct>>>,
  options: OrderQueryOptions,
) {
  const requestedWaitForSyncMs = options.waitForSyncMs ?? 0;
  const waitForSyncMs = requestedWaitForSyncMs > 0
    ? Math.max(600, Math.min(requestedWaitForSyncMs, PAYMENT_SYNC_WAIT_MAX_MS))
    : 0;
  if (waitForSyncMs <= 0 || currentOrder.paymentStatus !== "UNPAID" || currentOrder.status !== "PENDING") {
    return currentOrder;
  }

  const pollIntervalMs = Math.max(100, Math.min(options.pollIntervalMs ?? 250, 500));
  const deadline = Date.now() + waitForSyncMs;
  let order = currentOrder;

  while (Date.now() < deadline) {
    await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));

    const refreshed = await findOrderWithProduct(client, orderNo);
    if (!refreshed || refreshed.queryToken !== queryToken) {
      break;
    }

    order = refreshed;
    if (order.paymentStatus !== "UNPAID" || order.status !== "PENDING") {
      break;
    }
  }

  if (order.paymentStatus === "UNPAID" && order.status === "PENDING") {
    const refreshed = await findOrderWithProduct(client, orderNo);
    if (refreshed && refreshed.queryToken === queryToken) {
      order = refreshed;
    }
  }

  return order;
}

function parseDeliverySnapshot(contentSnapshot: string) {
  try {
    const parsed = JSON.parse(contentSnapshot) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [contentSnapshot];
  } catch {
    return [contentSnapshot];
  }
}

function getDeliveryContentsFromOrder(order: NonNullable<Awaited<ReturnType<typeof findOrderWithProduct>>>) {
  const successfulDeliveryContents = order.deliveries.filter((item) => item.status === "SUCCESS").flatMap((item) => parseDeliverySnapshot(item.contentSnapshot));
  const soldCardContents = order.cards.filter((card) => card.status === "SOLD").map((card) => card.content);
  return successfulDeliveryContents.length > 0 ? successfulDeliveryContents : soldCardContents;
}

function hasCompleteDeliveryContents(order: NonNullable<Awaited<ReturnType<typeof findOrderWithProduct>>>) {
  return getDeliveryContentsFromOrder(order).length >= order.quantity;
}

async function reconcileDeliveredStatus(
  client: PrismaClient,
  orderNo: string,
  queryToken: string,
  currentOrder: NonNullable<Awaited<ReturnType<typeof findOrderWithProduct>>>,
) {
  if (currentOrder.paymentStatus !== "PAID" || !hasCompleteDeliveryContents(currentOrder)) {
    return currentOrder;
  }

  if (currentOrder.deliveryStatus === "DELIVERED" && currentOrder.status === "DELIVERED") {
    return currentOrder;
  }

  await client.order.update({
    where: { orderNo },
    data: {
      status: "DELIVERED",
      deliveryStatus: "DELIVERED",
      deliveredAt: currentOrder.deliveredAt ?? new Date(),
      deliveryLockToken: null,
      deliveryLockedAt: null,
    },
  });

  const refreshed = await findOrderWithProduct(client, orderNo);
  return refreshed && refreshed.queryToken === queryToken ? refreshed : currentOrder;
}

async function waitForDeliverySync(
  client: PrismaClient,
  orderNo: string,
  queryToken: string,
  currentOrder: NonNullable<Awaited<ReturnType<typeof findOrderWithProduct>>>,
  options: OrderQueryOptions,
) {
  let order = await reconcileDeliveredStatus(client, orderNo, queryToken, currentOrder);
  const requestedWaitForDeliveryMs = options.waitForDeliveryMs ?? 900;
  const waitForDeliveryMs = requestedWaitForDeliveryMs > 0
    ? Math.max(700, Math.min(requestedWaitForDeliveryMs, DELIVERY_SYNC_WAIT_MAX_MS))
    : 0;

  if (waitForDeliveryMs <= 0 || order.paymentStatus !== "PAID" || order.deliveryStatus === "FAILED" || hasCompleteDeliveryContents(order)) {
    return order;
  }

  const pollIntervalMs = Math.max(120, Math.min(options.deliveryPollIntervalMs ?? options.pollIntervalMs ?? 220, 500));
  const recoveryAfterMs = Math.max(200, Math.min(options.deliveryRecoveryAfterMs ?? 650, waitForDeliveryMs));
  const deadline = Date.now() + waitForDeliveryMs;
  const startedAt = Date.now();
  let recoveryAttempted = false;

  while (Date.now() < deadline) {
    if (!recoveryAttempted && order.deliveryStatus !== "DELIVERED" && Date.now() - startedAt >= recoveryAfterMs) {
      recoveryAttempted = true;
      try {
        await deliverOrder(client, orderNo);
        const refreshed = await findOrderWithProduct(client, orderNo);
        if (!refreshed || refreshed.queryToken !== queryToken) {
          break;
        }
        order = await reconcileDeliveredStatus(client, orderNo, queryToken, refreshed);
        if (order.paymentStatus !== "PAID" || order.deliveryStatus === "FAILED" || hasCompleteDeliveryContents(order)) {
          break;
        }
      } catch (error) {
        logger.warn("order.query_delivery_recovery.skipped", {
          event: "order.query_delivery_recovery.skipped",
          orderNo,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await sleep(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));

    const refreshed = await findOrderWithProduct(client, orderNo);
    if (!refreshed || refreshed.queryToken !== queryToken) {
      break;
    }

    order = await reconcileDeliveredStatus(client, orderNo, queryToken, refreshed);
    if (order.paymentStatus !== "PAID" || order.deliveryStatus === "FAILED" || hasCompleteDeliveryContents(order)) {
      break;
    }
  }

  const refreshed = await findOrderWithProduct(client, orderNo);
  if (refreshed && refreshed.queryToken === queryToken) {
    order = await reconcileDeliveredStatus(client, orderNo, queryToken, refreshed);
  }

  return order;
}

function normalizeOrderIds(ids: number[]) {
  return [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
}

export async function deleteOrdersWithRelations(prisma: PrismaClient, ids: number[]) {
  const normalizedIds = normalizeOrderIds(ids);
  if (!normalizedIds.length) {
    return {
      ids: normalizedIds,
      count: 0,
      orderSummaries: [] as Array<{ id: number; orderNo: string }>,
    };
  }

  const orderSummaries = await prisma.order.findMany({
    where: { id: { in: normalizedIds } },
    select: {
      id: true,
      orderNo: true,
    },
  });

  const result = await deleteOrderRecords(prisma, normalizedIds);

  return {
    ids: normalizedIds,
    count: result.count,
    orderSummaries,
  };
}

export async function createOrder(input: {
  productId: number;
  quantity: number;
  paymentProvider: PaymentProvider;
  paymentChannel?: string;
  contactType: "EMAIL" | "QQ" | "TELEGRAM" | "OTHER";
  contactValue?: string;
  buyerNote?: string;
  // 安全验证参数
  turnstileToken?: string;
  orderToken?: string;
}) {
  const { prisma } = getOrderContext();
  const { contactValue } = validateOrderInput(input);

  // 获取站点安全设置（包含敏感信息，仅服务端使用）
  const siteSettings = await getFullSiteSetting(prisma);

  // 验证 Turnstile token
  if (siteSettings.enableTurnstile && siteSettings.turnstileSecretKey) {
    await validateTurnstileToken(input.turnstileToken, siteSettings.turnstileSecretKey);
  }

  // 验证短期下单 token
  if (siteSettings.enableOrderToken) {
    validateOrderToken(input.orderToken, input.productId);
  }

  const product = await getAdminProductById(input.productId, prisma);

  if (!product || product.status !== "ACTIVE") {
    throw notFoundError("商品不存在或未上架", "PRODUCT_NOT_AVAILABLE");
  }

  // 严格验证 quantity 边界
  const requestedQuantity = Math.floor(input.quantity);
  if (requestedQuantity < product.minBuy || requestedQuantity > product.maxBuy) {
    throw badRequestError(
      `购买数量必须在 ${product.minBuy}-${product.maxBuy} 之间`, 
      "ORDER_QUANTITY_OUT_OF_RANGE"
    );
  }

  // 检查库存（如果是有限库存模式）
  if (product.stockMode === "FINITE") {
    const availableStock = await prisma.card.count({
      where: {
        productId: product.id,
        status: "UNUSED",
      },
    });

    if (availableStock < requestedQuantity) {
      throw conflictError(
        availableStock > 0 
          ? `库存不足，当前可购买数量：${availableStock}` 
          : "商品已售罄",
        "INSUFFICIENT_STOCK"
      );
    }
  }

  const quantity = requestedQuantity;
  const orderNo = generateOrderNo();
  const queryToken = generateQueryToken();
  const paymentChannel = await validatePaymentSelection(
    {
      provider: input.paymentProvider,
      paymentChannel: input.paymentChannel,
    },
    prisma,
  );

  const order = await createOrderRecord(prisma, {
    orderNo,
    queryToken,
    productId: product.id,
    productNameSnapshot: product.name,
    unitPrice: product.price,
    quantity,
    amount: product.price * quantity,
    contactType: input.contactType,
    contactValue,
    buyerNote: input.buyerNote?.trim() || null,
    paymentProvider: input.paymentProvider,
    paymentChannel,
  });

  return {
    id: order.id,
    orderNo: order.orderNo,
    queryToken: order.queryToken,
    amount: order.amount,
    paymentProvider: order.paymentProvider,
    paymentChannel: order.paymentChannel,
    ...(await createPaymentForOrder(order.orderNo, prisma)),
  };
}

export async function getOrderForQuery(
  orderNo: string,
  queryToken: string,
  searchParams?: Record<string, string | undefined>,
  prisma?: PrismaClient,
  options: OrderQueryOptions = {},
) {
  const client = prisma ?? getOrderContext().prisma;
  let order = await findOrderWithProduct(client, orderNo);

  if (!order || order.queryToken !== queryToken) {
    return null;
  }

  const epayReturnPayload = pickEpayReturnPayload(searchParams);

  const canSyncEpayReturn =
    order.paymentProvider === "EPAY" &&
    (epayReturnPayload.out_trade_no || "") === orderNo &&
    Boolean(epayReturnPayload.sign) &&
    Boolean(epayReturnPayload.trade_status);

  if (canSyncEpayReturn) {
    await handlePaymentNotify("EPAY", epayReturnPayload, client, "return");
    order = await findOrderWithProduct(client, orderNo);

    if (!order || order.queryToken !== queryToken) {
      return null;
    }
  }

  order = await waitForPaymentSync(client, orderNo, queryToken, order, options);
  order = await waitForDeliverySync(client, orderNo, queryToken, order, options);

  const deliveryContents = getDeliveryContentsFromOrder(order);
  const paymentProviderName = await getPaymentProviderDisplayName(client, order.paymentProvider, order.paymentChannel);

  return {
    id: order.id,
    orderNo: order.orderNo,
    queryToken: order.queryToken,
    status: order.status,
    paymentStatus: order.paymentStatus,
    deliveryStatus: order.deliveryStatus,
    productName: order.productNameSnapshot,
    quantity: order.quantity,
    amount: order.amount,
    paymentProvider: order.paymentProvider,
    paymentChannel: order.paymentChannel,
    paymentProviderName,
    productSlug: order.product.slug,
    createdAt: order.createdAt.toISOString(),
    deliveryContents,
  };
}

export async function getOrderForEmailQuery(orderNo: string, email: string, prisma?: PrismaClient) {
  const client = prisma ?? getOrderContext().prisma;
  const normalizedOrderNo = orderNo.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedOrderNo || !normalizedEmail || !normalizedEmail.includes("@")) {
    return null;
  }

  const order = await findOrderWithProduct(client, normalizedOrderNo);
  if (!order || order.contactType !== "EMAIL" || (order.contactValue ?? "").trim().toLowerCase() !== normalizedEmail) {
    return null;
  }

  return getOrderForQuery(order.orderNo, order.queryToken, undefined, client);
}

export async function getAdminOrders(prisma?: PrismaClient) {
  const client = prisma ?? getOrderContext().prisma;
  const orders = await listOrderRecords(client);

  return orders.map((order) => ({
    id: order.id,
    orderNo: order.orderNo,
    productName: order.productNameSnapshot,
    amount: order.amount,
    quantity: order.quantity,
    paymentProvider: order.paymentProvider,
    status: order.status,
    paymentStatus: order.paymentStatus,
    deliveryStatus: order.deliveryStatus,
    createdAt: order.createdAt.toISOString(),
  }));
}

export async function createPaymentForExistingOrder(orderId: number) {
  const { prisma } = getOrderContext();
  const order = await findOrderById(prisma, orderId);

  if (!order) {
    throw notFoundError("订单不存在", "ORDER_NOT_FOUND");
  }

  return createPaymentForOrder(order.orderNo, prisma);
}

export async function closeOrder(orderId: number) {
  const adminContext = getAdminContext();
  const { prisma } = adminContext;
  const adminId = Number(adminContext.session?.user?.id);
  const order = await closeOrderRecord(prisma, orderId);

  await logAdminOperation(
    {
      action: "CLOSE_ORDER",
      targetType: "Order",
      targetId: String(order.id),
      detail: `orderNo=${order.orderNo}`,
    },
    {
      prisma,
      adminId,
    },
  );

  return {
    id: order.id,
    status: order.status,
  };
}

export async function deleteOrders(input: { ids: number[] }) {
  const adminContext = getAdminContext();
  const { prisma } = adminContext;
  const adminId = Number(adminContext.session?.user?.id);
  const ids = normalizeOrderIds(input.ids);

  if (!ids.length) {
    throw badRequestError("请选择要删除的订单", "ORDER_IDS_REQUIRED");
  }

  let result: Awaited<ReturnType<typeof deleteOrdersWithRelations>>;
  try {
    result = await deleteOrdersWithRelations(prisma, ids);
  } catch (error) {
    logger.error("delete orders failed", {
      ids,
      error: error instanceof Error ? error.message : String(error),
    });
    throw conflictError("订单关联数据清理失败，请稍后重试", "ORDER_DELETE_FAILED");
  }
  await logAdminOperation(
    {
      action: "DELETE_ORDERS",
      targetType: "Order",
      targetId: ids.join(","),
      detail: `requested=${ids.length};deleted=${result.count}`,
    },
    {
      prisma,
      adminId,
    },
  );

  const requestContext = getRequestContext();
  for (const order of result.orderSummaries) {
    try {
      await notifyOrderDeleted({
        prisma,
        orderNo: order.orderNo,
        clientIp: requestContext?.clientIp,
        siteUrl: requestContext?.origin,
        triggeredBy: "admin_order_delete",
      });
    } catch (error) {
      logger.error(error instanceof Error ? error : String(error), {
        event: "telegram.order_deleted.failed",
        orderNo: order.orderNo,
      });
    }
  }

  return {
    requested: ids.length,
    count: result.count,
  };
}

export async function getDashboardMetrics(prisma?: PrismaClient) {
  const client = prisma ?? getOrderContext().prisma;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 使用缓存优化仪表盘查询，避免频繁查询数据库
  const { cachedQuery } = await import('../../lib/utils/performance-monitor');
  
  const cacheKey = `dashboard-metrics-${today.getTime()}`;
  
  return cachedQuery(cacheKey, async () => {
    const [todayOrders, paidTodayOrders, productCount, availableCards] = await Promise.all([
      client.order.count({
        where: {
          createdAt: {
            gte: today,
          },
        },
      }),
      // 优化：只查询必要字段，避免查询完整记录
      client.order.aggregate({
        where: {
          paymentStatus: "PAID",
          paidAt: {
            gte: today,
          },
        },
        _sum: {
          amount: true,
        },
        _count: true,
      }),
      client.product.count(),
      client.card.count({
        where: {
          status: "UNUSED",
        },
      }),
    ]);

    const paidAmount = paidTodayOrders._sum.amount || 0;

    return [
      { label: "今日订单", value: String(todayOrders) },
      { label: "今日成交额", value: (paidAmount / 100).toFixed(2) },
      { label: "商品数", value: String(productCount) },
      { label: "剩余卡密", value: String(availableCards) },
    ];
  }, 2 * 60 * 1000); // 2分钟缓存
}

export async function getAdminOrderById(id: number, prisma?: PrismaClient) {
  const client = prisma ?? getOrderContext().prisma;
  const order = await findOrderById(client, id);
  if (!order) {
    return null;
  }

  return {
    id: order.id,
    orderNo: order.orderNo,
    queryToken: order.queryToken,
    productName: order.productNameSnapshot,
    amount: order.amount,
    quantity: order.quantity,
    paymentProvider: order.paymentProvider,
    paymentChannel: order.paymentChannel,
    status: order.status,
    paymentStatus: order.paymentStatus,
    deliveryStatus: order.deliveryStatus,
    contactValue: order.contactValue,
    buyerNote: order.buyerNote,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
    cards: order.cards.map((card) => ({
      id: card.id,
      content: card.content,
      status: card.status,
    })),
    deliveries: order.deliveries.map((item) => ({
      id: item.id,
      contentSnapshot: item.contentSnapshot,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
    })),
    paymentLogs: order.paymentLogs.map((item) => ({
      id: item.id,
      eventType: item.eventType,
      verifyStatus: item.verifyStatus,
      message: item.message,
      rawPayload: item.rawPayload,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

/**
 * 自动关闭过期未支付订单（由 Cron Trigger 定时调用）
 *
 * 逻辑：
 * 1. 查询所有 status=PENDING、paymentStatus=UNPAID、且创建时间超过 TTL 的订单
 * 2. 将其 status 更新为 CLOSED，设置 closedAt
 * 3. 为每个被关闭的订单写入一条 PaymentLog（eventType=AUTO_CLOSE）
 * 4. 不修改 paymentStatus，避免与延迟到达的支付回调产生竞态冲突
 *
 * 竞态安全说明：
 * - 如果支付回调在 auto-close 之后到达，updateOrderPayment 的 WHERE
 *   条件 `paymentStatus = "UNPAID"` 仍然匹配（因为 auto-close 不动该字段），
 *   回调会将订单重新打开为 PAID 并正常发货。
 * - 该场景会在 PaymentLog 中留下 "(reopened from CLOSED)" 标记。
 */
const ORDER_EXPIRE_MINUTES = 30;

export async function autoCloseExpiredOrders(prisma: PrismaClient) {
  const cutoff = new Date(Date.now() - ORDER_EXPIRE_MINUTES * 60 * 1000);

  // 先查出即将被关闭的订单（需要 orderId、orderNo、paymentProvider 用于写日志）
  const expiredOrders = await prisma.order.findMany({
    where: {
      status: "PENDING",
      paymentStatus: "UNPAID",
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      orderNo: true,
      paymentProvider: true,
    },
    take: 100,
  });

  if (expiredOrders.length === 0) {
    return 0;
  }

  // 批量关闭
  await prisma.order.updateMany({
    where: {
      id: { in: expiredOrders.map((o) => o.id) },
    },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
    },
  });

  // 为每个被关闭的订单写一条 PaymentLog
  await prisma.paymentLog.createMany({
    data: expiredOrders.map((order) => ({
      orderId: order.id,
      provider: order.paymentProvider,
      orderNo: order.orderNo,
      eventType: "AUTO_CLOSE",
      rawPayload: "{}",
      verifyStatus: "PENDING" as const,
      message: `订单超时未支付，已自动关闭（${ORDER_EXPIRE_MINUTES}分钟）`,
    })),
  });

  logger.info("auto_close_expired_orders", {
    closedCount: expiredOrders.length,
    expireMinutes: ORDER_EXPIRE_MINUTES,
    orderNos: expiredOrders.map((o) => o.orderNo),
  });

  return expiredOrders.length;
}
