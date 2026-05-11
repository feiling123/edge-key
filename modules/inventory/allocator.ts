import type { PrismaClient } from "../../generated/prisma/client";
import { conflictError } from "../../lib/app-error";

type CardStore = Pick<PrismaClient, "card">;

export async function allocateCardsForOrder(prisma: CardStore, orderId: number, productId: number, quantity: number) {
  const cards = await prisma.card.findMany({
    where: {
      productId,
      status: "UNUSED",
      orderId: null,
    },
    orderBy: [{ id: "asc" }],
    take: quantity,
  });

  if (cards.length < quantity) {
    throw conflictError("库存不足，无法完成自动发货", "CARD_INVENTORY_SHORTAGE");
  }

  for (const card of cards) {
    const updated = await prisma.card.updateMany({
      where: { id: card.id, status: "UNUSED", orderId: null },
      data: {
        status: "SOLD",
        orderId,
        soldAt: new Date(),
      },
    });

    if (updated.count !== 1) {
      throw conflictError("库存正在处理，请稍后刷新订单", "CARD_CONCURRENT_ALLOCATION");
    }
  }

  return cards;
}
