import type { PrismaClient } from "../../generated/prisma/client";
import { getErrorMessage } from "../../lib/app-error";
import { logger } from "../../lib/logger";
import { notifyDeliveryFailed, notifyDeliverySuccess } from "../notify/service";
import { conflictError, notFoundError } from "../../lib/app-error";
import { allocateCardsForOrder } from "../inventory/allocator";

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

async function getDeliveredItems(prisma: PrismaClient, orderNo: string) {
  const order = await prisma.order.findUnique({
    where: { orderNo },
    include: { cards: true, deliveries: true },
  });

  if (!order) return null;
  const items = getSuccessfulDeliveryItems(order.deliveries);
  const deliveredItems = items.length > 0 ? items : order.cards.map((card) => card.content);
  if (order.deliveryStatus !== "DELIVERED" && deliveredItems.length === 0) return null;
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

export async function deliverOrder(prisma: PrismaClient, orderNo: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderNo },
        include: {
          product: true,
          cards: true,
          deliveries: true,
        },
      });

      if (!order) {
        throw notFoundError("订单不存在", "ORDER_NOT_FOUND");
      }

      const existingItems = getSuccessfulDeliveryItems(order.deliveries);
      const deliveredItems = existingItems.length > 0 ? existingItems : order.cards.map((card) => card.content);
      if (order.deliveryStatus === "DELIVERED" || deliveredItems.length > 0) {
        if (order.deliveryStatus !== "DELIVERED") {
          await tx.order.update({
            where: { orderNo },
            data: {
              status: "DELIVERED",
              deliveryStatus: "DELIVERED",
              deliveredAt: order.deliveredAt ?? new Date(),
            },
          });
        }

        return {
          success: true,
          items: deliveredItems,
          notify: false,
          order,
        };
      }

      if (order.paymentStatus !== "PAID") {
        throw conflictError("订单尚未支付", "ORDER_NOT_PAID");
      }

      const cards = await allocateCardsForOrder(tx, order.id, order.productId, order.quantity);
      const contents = cards.map((card) => card.content);

      await tx.orderDelivery.create({
        data: {
          orderId: order.id,
          deliveryType: "CARD",
          contentSnapshot: JSON.stringify(contents),
          status: "SUCCESS",
        },
      });

      await tx.order.update({
        where: { orderNo },
        data: {
          status: "DELIVERED",
          deliveryStatus: "DELIVERED",
          deliveredAt: new Date(),
        },
      });

      return {
        success: true,
        items: contents,
        notify: true,
        order,
      };
    });

    if (result.notify) {
      try {
        await notifyDeliverySuccess({
          prisma,
          orderId: result.order.id,
          orderNo: result.order.orderNo,
          queryToken: result.order.queryToken,
          productName: result.order.productNameSnapshot,
          quantity: result.order.quantity,
          items: result.items,
        });
      } catch (error) {
        logger.error(error instanceof Error ? error : String(error), {
          event: "telegram.delivery_success.failed",
          orderNo: result.order.orderNo,
        });
      }
    }

    return {
      success: true,
      items: result.items,
    };
  } catch (error) {
    const delivered = await waitForConcurrentDelivery(prisma, orderNo);
    if (delivered) return delivered;

    const order = await prisma.order.findUnique({
      where: { orderNo },
    });

    if (!order) {
      throw error;
    }

    await prisma.orderDelivery.deleteMany({
      where: {
        orderId: order.id,
        deliveryType: "CARD",
        status: "FAILED",
      },
    });

    await prisma.orderDelivery.create({
      data: {
        orderId: order.id,
        deliveryType: "CARD",
        contentSnapshot: error instanceof Error ? error.message : "delivery failed",
        status: "FAILED",
      },
    });

    await prisma.order.update({
      where: { orderNo: order.orderNo },
      data: {
        status: "FAILED",
        deliveryStatus: "FAILED",
        deliveredAt: null,
      },
    });

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
