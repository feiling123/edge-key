import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client";
import { conflictError, getErrorMessage, notFoundError } from "../../lib/app-error";
import { logger } from "../../lib/logger";
import {
  finalizeReservedCardsForOrder,
  releaseReservedCardsForOrder,
  releaseStaleReservedCardsForOrder,
  reserveCardsForOrder,
} from "../inventory/allocator";
import { notifyDeliveryFailed, notifyDeliverySuccess } from "../notify/service";

const DELIVERY_LOCK_TTL_MS = 60_000;

function parseDeliveryItems(contentSnapshot: string) {
  try {
    const parsed = JSON.parse(contentSnapshot) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [contentSnapshot];
  } catch {
    return [contentSnapshot];
  }
}

function getSuccessfulDeliveryItems(deliveries: Array<{ contentSnapshot: string; status: string }>) {
  return deliveries.filter((item) => item.status === "SUCCESS").flatMap((item) => parseDeliveryItems(item.contentSnapshot));
}

function getSoldCardItems(cards: Array<{ content: string; status: string }>, quantity: number) {
  const items = cards.filter((card) => card.status === "SOLD").map((card) => card.content);
  return items.length >= quantity ? items : [];
}

async function loadDeliveryOrder(prisma: PrismaClient, orderNo: string) {
  return prisma.order.findUnique({
    where: { orderNo },
    include: {
      product: true,
      cards: true,
      deliveries: true,
    },
  });
}

function getDeliveredItemsFromOrder(order: NonNullable<Awaited<ReturnType<typeof loadDeliveryOrder>>>) {
  const successfulItems = getSuccessfulDeliveryItems(order.deliveries);
  if (successfulItems.length > 0) return successfulItems;

  const soldItems = getSoldCardItems(order.cards, order.quantity);
  if (soldItems.length > 0) return soldItems;

  return [];
}

async function getDeliveredItems(prisma: PrismaClient, orderNo: string) {
  const order = await loadDeliveryOrder(prisma, orderNo);
  if (!order) return null;

  const deliveredItems = getDeliveredItemsFromOrder(order);
  if (!deliveredItems.length) return null;

  if (order.deliveryStatus !== "DELIVERED" || order.status !== "DELIVERED") {
    await markOrderDelivered(prisma, order.orderNo);
  }

  return {
    success: true,
    items: deliveredItems,
  };
}

async function waitForConcurrentDelivery(prisma: PrismaClient, orderNo: string) {
  for (let index = 0; index < 5; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const delivered = await getDeliveredItems(prisma, orderNo);
    if (delivered) return delivered;
  }

  return null;
}

function isUniqueConstraintError(error: unknown) {
  const value = error as { code?: string; message?: string } | null;
  return value?.code === "P2002" || /unique constraint|unique/i.test(value?.message || "");
}

async function ensureSuccessDeliveryRecord(prisma: PrismaClient, orderId: number, contents: string[]) {
  try {
    await prisma.orderDelivery.create({
      data: {
        orderId,
        deliveryType: "CARD",
        contentSnapshot: JSON.stringify(contents),
        status: "SUCCESS",
      },
    });
    return { created: true, items: contents };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const existing = await prisma.orderDelivery.findFirst({
      where: {
        orderId,
        deliveryType: "CARD",
        status: "SUCCESS",
      },
      orderBy: [{ id: "asc" }],
    });
    if (!existing) throw error;
    return { created: false, items: parseDeliveryItems(existing.contentSnapshot) };
  }
}

async function markOrderDelivered(prisma: PrismaClient, orderNo: string) {
  await prisma.order.update({
    where: { orderNo },
    data: {
      status: "DELIVERED",
      deliveryStatus: "DELIVERED",
      deliveredAt: new Date(),
      deliveryLockToken: null,
      deliveryLockedAt: null,
    },
  });
}

async function acquireDeliveryLock(prisma: PrismaClient, orderId: number, token: string) {
  const staleBefore = new Date(Date.now() - DELIVERY_LOCK_TTL_MS);
  return prisma.order.updateMany({
    where: {
      id: orderId,
      paymentStatus: "PAID",
      deliveryStatus: { not: "DELIVERED" },
      OR: [
        { deliveryLockToken: null },
        { deliveryLockedAt: null },
        { deliveryLockedAt: { lt: staleBefore } },
      ],
    },
    data: {
      status: "PAID",
      deliveryLockToken: token,
      deliveryLockedAt: new Date(),
    },
  });
}

async function markOrderDeliveryFailed(prisma: PrismaClient, orderId: number, orderNo: string, token: string) {
  await prisma.order.updateMany({
    where: {
      id: orderId,
      deliveryLockToken: token,
    },
    data: {
      status: "FAILED",
      deliveryStatus: "FAILED",
      deliveredAt: null,
      deliveryLockToken: null,
      deliveryLockedAt: null,
    },
  });

  const delivered = await getDeliveredItems(prisma, orderNo);
  if (delivered) {
    await markOrderDelivered(prisma, orderNo);
  }
}

async function recordDeliveryFailure(prisma: PrismaClient, orderId: number, error: unknown) {
  await prisma.orderDelivery.deleteMany({
    where: {
      orderId,
      deliveryType: "CARD",
      status: "FAILED",
    },
  });

  await prisma.orderDelivery.create({
    data: {
      orderId,
      deliveryType: "CARD",
      contentSnapshot: getErrorMessage(error, "delivery failed"),
      status: "FAILED",
    },
  });
}

async function notifySuccess(prisma: PrismaClient, order: NonNullable<Awaited<ReturnType<typeof loadDeliveryOrder>>>, items: string[]) {
  try {
    await notifyDeliverySuccess({
      prisma,
      orderId: order.id,
      orderNo: order.orderNo,
      queryToken: order.queryToken,
      productName: order.productNameSnapshot,
      quantity: order.quantity,
      items,
    });
  } catch (error) {
    logger.error(error instanceof Error ? error : String(error), {
      event: "telegram.delivery_success.failed",
      orderNo: order.orderNo,
    });
  }
}

async function notifyFailure(prisma: PrismaClient, order: { id: number; orderNo: string; queryToken: string; productNameSnapshot: string }, error: unknown) {
  try {
    await notifyDeliveryFailed({
      prisma,
      orderId: order.id,
      orderNo: order.orderNo,
      queryToken: order.queryToken,
      productName: order.productNameSnapshot,
      errorMessage: getErrorMessage(error, "delivery failed"),
    });
  } catch (notifyError) {
    logger.error(notifyError instanceof Error ? notifyError : String(notifyError), {
      event: "telegram.delivery_failed.failed",
      orderNo: order.orderNo,
    });
  }
}

export async function deliverOrder(prisma: PrismaClient, orderNo: string) {
  const order = await loadDeliveryOrder(prisma, orderNo);
  if (!order) {
    throw notFoundError("订单不存在", "ORDER_NOT_FOUND");
  }

  const deliveredItems = getDeliveredItemsFromOrder(order);
  if (deliveredItems.length > 0) {
    if (order.deliveryStatus !== "DELIVERED" || order.status !== "DELIVERED") {
      await markOrderDelivered(prisma, order.orderNo);
    }
    return {
      success: true,
      items: deliveredItems,
    };
  }

  if (order.paymentStatus !== "PAID") {
    throw conflictError("订单尚未支付", "ORDER_NOT_PAID");
  }

  const lockToken = randomUUID();
  const locked = await acquireDeliveryLock(prisma, order.id, lockToken);
  if (locked.count !== 1) {
    const delivered = await waitForConcurrentDelivery(prisma, order.orderNo);
    if (delivered) return delivered;
    throw conflictError("订单正在发货处理，请稍后刷新", "ORDER_DELIVERY_IN_PROGRESS");
  }

  try {
    await releaseStaleReservedCardsForOrder(prisma, order.id);

    const cards = await reserveCardsForOrder(prisma, order.id, order.productId, order.quantity, lockToken);
    const contents = cards.map((card) => card.content);
    await finalizeReservedCardsForOrder(prisma, order.id, cards.map((card) => card.id), lockToken);

    const delivery = await ensureSuccessDeliveryRecord(prisma, order.id, contents);
    await markOrderDelivered(prisma, order.orderNo);

    if (delivery.created) {
      await notifySuccess(prisma, order, delivery.items);
    }

    return {
      success: true,
      items: delivery.items,
    };
  } catch (error) {
    await releaseReservedCardsForOrder(prisma, order.id, lockToken);

    const refreshed = await loadDeliveryOrder(prisma, order.orderNo);
    if (refreshed) {
      const recoveredItems = getDeliveredItemsFromOrder(refreshed);
      if (recoveredItems.length > 0) {
        const delivery = await ensureSuccessDeliveryRecord(prisma, refreshed.id, recoveredItems);
        await markOrderDelivered(prisma, refreshed.orderNo);
        if (delivery.created) {
          await notifySuccess(prisma, refreshed, delivery.items);
        }
        return {
          success: true,
          items: delivery.items,
        };
      }
    }

    await recordDeliveryFailure(prisma, order.id, error);
    await markOrderDeliveryFailed(prisma, order.id, order.orderNo, lockToken);
    await notifyFailure(prisma, order, error);

    throw error;
  }
}

export async function redeliverOrder(prisma: PrismaClient, orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw notFoundError("订单不存在", "ORDER_NOT_FOUND");
  }

  if (order.paymentStatus !== "PAID") {
    throw conflictError("订单未支付，无法补发", "ORDER_NOT_PAID");
  }

  if (order.deliveryStatus === "DELIVERED") {
    throw conflictError("订单已发货，无需补发", "ORDER_ALREADY_DELIVERED");
  }

  return deliverOrder(prisma, order.orderNo);
}
