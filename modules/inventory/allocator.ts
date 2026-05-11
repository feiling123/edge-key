import type { PrismaClient } from "../../generated/prisma/client";
import { conflictError } from "../../lib/app-error";

type CardStore = Pick<PrismaClient, "card">;
type ReservedCard = Awaited<ReturnType<CardStore["card"]["findMany"]>>[number];

export async function reserveCardsForOrder(
  prisma: CardStore,
  orderId: number,
  productId: number,
  quantity: number,
  lockToken: string,
) {
  const reserved: ReservedCard[] = [];
  const attemptedIds = new Set<number>();
  const maxAttempts = Math.max(quantity * 4, quantity + 8);

  while (reserved.length < quantity && attemptedIds.size < maxAttempts) {
    const where: {
      productId: number;
      status: "UNUSED";
      orderId: null;
      id?: { notIn: number[] };
    } = {
      productId,
      status: "UNUSED",
      orderId: null,
    };

    if (attemptedIds.size) {
      where.id = { notIn: [...attemptedIds] };
    }

    const candidates = await prisma.card.findMany({
      where,
      orderBy: [{ id: "asc" }],
      take: quantity - reserved.length + 4,
    });

    if (!candidates.length) break;

    for (const card of candidates) {
      attemptedIds.add(card.id);
      const updated = await prisma.card.updateMany({
        where: {
          id: card.id,
          status: "UNUSED",
          orderId: null,
        },
        data: {
          status: "LOCKED",
          orderId,
          deliveryLockToken: lockToken,
        },
      });

      if (updated.count === 1) {
        reserved.push(card);
        if (reserved.length >= quantity) break;
      }
    }
  }

  if (reserved.length < quantity) {
    await releaseReservedCardsForOrder(prisma, orderId, lockToken);
    throw conflictError("库存不足，无法完成自动发货", "CARD_INVENTORY_SHORTAGE");
  }

  return reserved;
}

export async function finalizeReservedCardsForOrder(
  prisma: CardStore,
  orderId: number,
  cardIds: number[],
  lockToken: string,
) {
  if (!cardIds.length) return;

  const updated = await prisma.card.updateMany({
    where: {
      id: { in: cardIds },
      orderId,
      status: "LOCKED",
      deliveryLockToken: lockToken,
    },
    data: {
      status: "SOLD",
      soldAt: new Date(),
      deliveryLockToken: null,
    },
  });

  if (updated.count !== cardIds.length) {
    throw conflictError("库存状态已变化，请稍后重试", "CARD_FINALIZE_CONFLICT");
  }
}

export async function releaseReservedCardsForOrder(
  prisma: CardStore,
  orderId: number,
  lockToken: string,
) {
  await prisma.card.updateMany({
    where: {
      orderId,
      status: "LOCKED",
      deliveryLockToken: lockToken,
    },
    data: {
      status: "UNUSED",
      orderId: null,
      soldAt: null,
      deliveryLockToken: null,
    },
  });
}

export async function releaseStaleReservedCardsForOrder(prisma: CardStore, orderId: number) {
  await prisma.card.updateMany({
    where: {
      orderId,
      status: "LOCKED",
    },
    data: {
      status: "UNUSED",
      orderId: null,
      soldAt: null,
      deliveryLockToken: null,
    },
  });
}
