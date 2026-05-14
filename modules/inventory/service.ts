import { getContext } from "telefunc";
import type { PrismaClient } from "../../generated/prisma/client";
import { badRequestError, conflictError, isAppError } from "../../lib/app-error";
import { getAdminContext, logAdminOperation } from "../auth/service";
import { logger } from "../../lib/logger";
import { parseCardLines } from "./importer";
import {
  countCardStats,
  createCardRecord,
  createManyCards,
  deleteCardsByIds,
  deleteUnusedCardsByProduct,
  findCardById,
  findCardsByIds,
  findCardsByOrderIds,
  listCardRecords,
  listCardRecordsPaged,
  updateUnusedCardById,
} from "./repository";

function getInventoryContext() {
  return getContext<{ prisma: PrismaClient }>();
}

function previewCard(content: string) {
  if (content.length <= 8) {
    return content;
  }

  return `${content.slice(0, 4)}****${content.slice(-4)}`;
}

const DELETABLE_CARD_STATUSES = ["UNUSED", "SOLD", "DISABLED"] as const;
const DELIVERY_LOCK_TTL_MS = 60_000;
const ORDER_DELETE_MAX_ATTEMPTS = 3;

function createDeletionLockToken() {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `card-delete:${random}`;
}

function getDeletableCardIds(cards: Array<{ id: number; status: string }>) {
  return cards.filter((item) => DELETABLE_CARD_STATUSES.includes(item.status as (typeof DELETABLE_CARD_STATUSES)[number])).map((item) => item.id);
}

function getLockedCardIds(cards: Array<{ id: number; status: string }>) {
  return cards.filter((item) => item.status === "LOCKED").map((item) => item.id);
}

function isForeignKeyConstraintError(error: unknown) {
  const value = error as { code?: unknown; message?: unknown };
  if (value?.code === "P2003") return true;
  const message = typeof value?.message === "string" ? value.message : "";
  return /foreign key|constraint failed|FOREIGN KEY constraint failed/i.test(message);
}

function normalizeCardId(value: number) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequestError("卡密 ID 无效", "CARD_ID_INVALID");
  }
  return id;
}

function normalizeCardIds(value: unknown) {
  if (!Array.isArray(value)) {
    throw badRequestError("请选择要删除的卡密", "CARD_IDS_REQUIRED");
  }
  const ids = [...new Set(value.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) {
    throw badRequestError("请选择要删除的卡密", "CARD_IDS_REQUIRED");
  }
  return ids;
}

function normalizeProductId(value: number) {
  const productId = Number(value);
  if (!Number.isInteger(productId) || productId <= 0) {
    throw badRequestError("请选择商品", "CARD_PRODUCT_REQUIRED");
  }
  return productId;
}

async function assertProductExists(prisma: PrismaClient, productId: number) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) {
    throw badRequestError("请选择有效商品", "CARD_PRODUCT_REQUIRED");
  }
}

async function deleteCardsOrThrow(prisma: PrismaClient, ids: number[], context: Record<string, unknown>) {
  const cardIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!cardIds.length) return { count: 0 };

  try {
    return await deleteCardsByIds(prisma, cardIds);
  } catch (error) {
    logger.error("inventory.delete_cards.failed", {
      event: "inventory.delete_cards.failed",
      ids: cardIds,
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
    throw conflictError("卡密删除失败，请稍后重试", "CARD_DELETE_FAILED");
  }
}

async function assertOrdersStillLockedForCardDeletion(prisma: PrismaClient, orderIds: number[], deletionLockToken: string) {
  const changedOrders = await prisma.order.findMany({
    where: {
      id: { in: orderIds },
      OR: [
        { deliveryLockToken: null },
        { deliveryLockToken: { not: deletionLockToken } },
      ],
    },
    select: { id: true },
  });
  if (changedOrders.length) {
    throw conflictError("关联订单正在发货中，请稍后再删除", "CARD_DELETE_ORDER_DELIVERING");
  }
}

async function deleteOrdersWithDeliveryCleanupOrThrow(
  prisma: PrismaClient,
  orderIds: number[],
  deletionLockToken: string,
  context: Record<string, unknown>,
) {
  for (let attempt = 1; attempt <= ORDER_DELETE_MAX_ATTEMPTS; attempt += 1) {
    await assertOrdersStillLockedForCardDeletion(prisma, orderIds, deletionLockToken);
    await prisma.orderDelivery.deleteMany({ where: { orderId: { in: orderIds } } });

    try {
      const orderDeleteResult = await prisma.order.deleteMany({
        where: {
          id: { in: orderIds },
          deliveryLockToken: deletionLockToken,
        },
      });
      if (orderDeleteResult.count !== orderIds.length) {
        throw conflictError("关联订单状态已变化，请刷新后重试", "CARD_DELETE_ORDER_CHANGED");
      }
      return orderDeleteResult;
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }

      if (isForeignKeyConstraintError(error)) {
        logger.warn("inventory.delete_cards.order_fk_retry", {
          event: "inventory.delete_cards.order_fk_retry",
          attempt,
          orderIds,
          ...context,
          error: error instanceof Error ? error.message : String(error),
        });

        if (attempt < ORDER_DELETE_MAX_ATTEMPTS) {
          continue;
        }

        throw conflictError("关联订单仍有发货记录占用，暂时无法删除", "CARD_DELETE_ORDER_HAS_DELIVERY");
      }

      throw error;
    }
  }

  throw conflictError("关联订单清理失败，已售卡密暂时无法删除", "CARD_DELETE_ORDER_FAILED");
}

async function deleteCardsWithOrderCleanupOrThrow(
  prisma: PrismaClient,
  cardIds: number[],
  orderIds: number[],
  context: Record<string, unknown>,
) {
  const idsToDelete = [...new Set(cardIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  const idsToCleanup = [...new Set(orderIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!idsToDelete.length) {
    throw badRequestError("请选择要删除的卡密", "CARD_IDS_REQUIRED");
  }
  if (!idsToCleanup.length) {
    return deleteCardsOrThrow(prisma, idsToDelete, context);
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: idsToCleanup } },
    select: { id: true, orderNo: true, deliveryLockToken: true, deliveryLockedAt: true },
  });
  const existingIds = orders.map((order) => order.id);
  if (!existingIds.length) {
    return deleteCardsOrThrow(prisma, idsToDelete, context);
  }

  const now = Date.now();
  const activeLockedOrders = orders.filter((order) => {
    if (!order.deliveryLockToken) return false;
    if (!order.deliveryLockedAt) return true;
    return now - order.deliveryLockedAt.getTime() < DELIVERY_LOCK_TTL_MS;
  });
  if (activeLockedOrders.length) {
    throw conflictError("关联订单正在发货中，请稍后再删除", "CARD_DELETE_ORDER_DELIVERING");
  }

  const orderNos = orders.map((order) => order.orderNo).filter(Boolean);
  const lockedCards = await prisma.card.findMany({
    where: {
      orderId: { in: existingIds },
      status: "LOCKED",
    },
    select: {
      id: true,
    },
  });
  if (lockedCards.length) {
    throw conflictError("关联订单仍有锁定中的卡密，暂时无法删除", "CARD_DELETE_LOCKED_ORDER");
  }

  const deletionLockToken = createDeletionLockToken();

  try {
    const targetCardCount = await prisma.card.count({
      where: {
        id: { in: idsToDelete },
        status: { in: [...DELETABLE_CARD_STATUSES] },
      },
    });
    if (targetCardCount !== idsToDelete.length) {
      throw badRequestError("卡密不存在或锁定中，无法删除", "CARD_DELETE_FAILED");
    }

    const staleBefore = new Date(Date.now() - DELIVERY_LOCK_TTL_MS);
    const lockResult = await prisma.order.updateMany({
      where: {
        id: { in: existingIds },
        OR: [
          { deliveryLockToken: null },
          { deliveryLockedAt: null },
          { deliveryLockedAt: { lt: staleBefore } },
        ],
      },
      data: {
        deliveryLockToken: deletionLockToken,
        deliveryLockedAt: new Date(),
      },
    });
    if (lockResult.count !== existingIds.length) {
      throw conflictError("关联订单正在发货中，请稍后再删除", "CARD_DELETE_ORDER_DELIVERING");
    }

    // 优化：使用事务批量处理删除操作，减少数据库往返
    await prisma.$transaction(async (tx) => {
      await tx.orderDelivery.deleteMany({ where: { orderId: { in: existingIds } } });
      await tx.paymentLog.deleteMany({ where: { orderId: { in: existingIds } } });
      if (orderNos.length) {
        await tx.paymentLog.deleteMany({ where: { orderNo: { in: orderNos } } });
      }
      await tx.telegramLog.updateMany({ where: { orderId: { in: existingIds } }, data: { orderId: null } });
      await tx.card.updateMany({
        where: {
          id: { in: idsToDelete },
          orderId: { in: existingIds },
          status: { in: [...DELETABLE_CARD_STATUSES] },
        },
        data: {
          orderId: null,
          deliveryLockToken: null,
        },
      });
    });

    await deleteOrdersWithDeliveryCleanupOrThrow(prisma, existingIds, deletionLockToken, context);

    const deleteResult = await deleteCardsByIds(prisma, idsToDelete);
    if (deleteResult.count !== idsToDelete.length) {
      throw conflictError("卡密删除不完整，请刷新后重试", "CARD_DELETE_PARTIAL");
    }
    return deleteResult;
  } catch (error) {
    if (isAppError(error)) {
      throw error;
    }
    logger.error("inventory.delete_cards.order_cleanup_failed", {
      event: "inventory.delete_cards.order_cleanup_failed",
      cardIds: idsToDelete,
      orderIds: existingIds,
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
    throw conflictError("关联订单清理失败，已售卡密暂时无法删除", "CARD_DELETE_ORDER_FAILED");
  }
}

export async function getInventoryOverview(prisma?: PrismaClient) {
  const client = prisma ?? getInventoryContext().prisma;
  const stats = await countCardStats(client);

  const summary = {
    total: 0,
    available: 0,
    sold: 0,
  };

  for (const item of stats) {
    summary.total += item._count._all;
    if (item.status === "UNUSED") summary.available += item._count._all;
    if (item.status === "SOLD") summary.sold += item._count._all;
  }

  return summary;
}

export async function getAdminCards(prisma?: PrismaClient) {
  const client = prisma ?? getInventoryContext().prisma;
  const cards = await listCardRecords(client);

  return cards.map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.product.name,
    status: item.status,
    batchNo: item.batchNo,
    orderId: item.orderId,
    orderNo: item.order?.orderNo ?? null,
    soldAt: item.soldAt ? item.soldAt.toISOString() : null,
    createdAt: item.createdAt.toISOString(),
    content: item.content,
    contentPreview: previewCard(item.content),
  }));
}

export async function createCard(input: { productId: number; content: string; batchNo?: string }) {
  const adminContext = getAdminContext();
  const { prisma } = adminContext;
  const adminId = Number(adminContext.session?.user?.id);
  const productId = normalizeProductId(input.productId);
  const content = input.content.trim();

  await assertProductExists(prisma, productId);

  if (!content) {
    throw badRequestError("卡密内容不能为空", "CARD_CONTENT_REQUIRED");
  }

  const card = await createCardRecord(prisma, {
    productId,
    content,
    batchNo: input.batchNo?.trim() || null,
  });

  await logAdminOperation(
    {
      action: "CREATE_CARD",
      targetType: "Card",
      targetId: String(card.id),
      detail: `productId=${card.productId}`,
    },
    {
      prisma,
      adminId,
    },
  );

  return {
    id: card.id,
    productId: card.productId,
    productName: card.product.name,
    status: card.status,
    batchNo: card.batchNo,
    orderId: card.orderId,
    orderNo: card.order?.orderNo ?? null,
    soldAt: null,
    createdAt: card.createdAt.toISOString(),
    content: card.content,
    contentPreview: previewCard(card.content),
  };
}

export async function importCards(input: { productId: number; lines: string; batchNo?: string }) {
  const adminContext = getAdminContext();
  const { prisma } = adminContext;
  const adminId = Number(adminContext.session?.user?.id);
  const productId = normalizeProductId(input.productId);
  const items = parseCardLines(input.lines);

  await assertProductExists(prisma, productId);

  if (!items.length) {
    throw badRequestError("没有可导入的卡密内容", "CARD_IMPORT_EMPTY");
  }

  await createManyCards(
    prisma,
    items.map((content) => ({
      productId,
      content,
      batchNo: input.batchNo?.trim() || null,
    })),
  );

  await logAdminOperation(
    {
      action: "IMPORT_CARDS",
      targetType: "Card",
      targetId: String(productId),
      detail: `count=${items.length}`,
    },
    {
      prisma,
      adminId,
    },
  );

  return {
    count: items.length,
  };
}

export async function deleteUnusedCards(input: { productId: number }) {
  const adminContext = getAdminContext();
  const { prisma } = adminContext;
  const adminId = Number(adminContext.session?.user?.id);
  const productId = normalizeProductId(input.productId);
  const result = await deleteUnusedCardsByProduct(prisma, productId);

  await logAdminOperation(
    {
      action: "DELETE_UNUSED_CARDS",
      targetType: "Card",
      targetId: String(productId),
      detail: `count=${result.count}`,
    },
    {
      prisma,
      adminId,
    },
  );

  return {
    count: result.count,
  };
}

export async function deleteCard(input: { id: number }) {
  const adminContext = getAdminContext();
  const { prisma } = adminContext;
  const adminId = Number(adminContext.session?.user?.id);
  const cardId = normalizeCardId(input.id);
  const card = await findCardById(prisma, cardId);
  if (!card || card.status === "LOCKED") {
    throw badRequestError("卡密不存在或锁定中，无法删除", "CARD_DELETE_FAILED");
  }

  let idsToDelete = [card.id];
  let orderIdsToCleanup: number[] = [];
  if (card?.orderId) {
    const orderCards = await findCardsByOrderIds(prisma, [card.orderId]);
    const lockedCardIds = getLockedCardIds(orderCards);
    if (lockedCardIds.length) {
      throw conflictError("关联订单仍有锁定中的卡密，暂时无法删除", "CARD_DELETE_LOCKED_ORDER");
    }
    idsToDelete = [...new Set([...idsToDelete, ...getDeletableCardIds(orderCards)])];
    orderIdsToCleanup = [card.orderId];
  }
  const result = await deleteCardsWithOrderCleanupOrThrow(prisma, idsToDelete, orderIdsToCleanup, { cardId, orderId: card?.orderId ?? null });
  if (result.count === 0) throw badRequestError("卡密不存在或锁定中，无法删除", "CARD_DELETE_FAILED");
  await logAdminOperation({ action: "DELETE_CARD", targetType: "Card", targetId: String(cardId), detail: "" }, { prisma, adminId });
  return { id: cardId };
}

export async function deleteCards(input: { ids: number[] }) {
  const adminContext = getAdminContext();
  const { prisma } = adminContext;
  const adminId = Number(adminContext.session?.user?.id);
  const ids = normalizeCardIds(input.ids);

  const cards = await findCardsByIds(prisma, ids);
  const deletableCards = cards.filter((item) => item.status !== "LOCKED");
  if (!deletableCards.length) {
    throw badRequestError("卡密不存在或锁定中，无法删除", "CARD_DELETE_FAILED");
  }

  const orderIds = [...new Set(deletableCards.map((item) => item.orderId).filter((id): id is number => typeof id === "number" && id > 0))];
  let idsToDelete = deletableCards.map((item) => item.id);
  if (orderIds.length) {
    const orderCards = await findCardsByOrderIds(prisma, orderIds);
    const lockedCardIds = getLockedCardIds(orderCards);
    if (lockedCardIds.length) {
      throw conflictError("关联订单仍有锁定中的卡密，暂时无法删除", "CARD_DELETE_LOCKED_ORDER");
    }
    idsToDelete = [...new Set([...idsToDelete, ...getDeletableCardIds(orderCards)])];
  }
  const result = await deleteCardsWithOrderCleanupOrThrow(prisma, idsToDelete, orderIds, { requestedIds: ids, orderIds });
  await logAdminOperation(
    {
      action: "DELETE_CARDS",
      targetType: "Card",
      targetId: idsToDelete.join(","),
      detail: `requested=${ids.length};expanded=${idsToDelete.length};deleted=${result.count}`,
    },
    { prisma, adminId },
  );

  return {
    requested: ids.length,
    count: result.count,
  };
}

export async function updateCard(input: { id: number; productId: number; content: string; batchNo?: string }) {
  const adminContext = getAdminContext();
  const { prisma } = adminContext;
  const adminId = Number(adminContext.session?.user?.id);
  const content = input.content.trim();
  const productId = normalizeProductId(input.productId);

  if (!Number.isInteger(input.id) || input.id <= 0) {
    throw badRequestError("卡密 ID 无效", "CARD_ID_INVALID");
  }

  await assertProductExists(prisma, productId);

  if (!content) {
    throw badRequestError("卡密内容不能为空", "CARD_CONTENT_REQUIRED");
  }

  const result = await updateUnusedCardById(prisma, input.id, {
    productId,
    content,
    batchNo: input.batchNo?.trim() || null,
  });
  if (result.count === 0) throw badRequestError("卡密不存在或锁定中，无法编辑", "CARD_UPDATE_FAILED");

  const card = await findCardById(prisma, input.id);
  await logAdminOperation(
    {
      action: "UPDATE_CARD",
      targetType: "Card",
      targetId: String(input.id),
      detail: `productId=${productId}`,
    },
    { prisma, adminId },
  );

  return card ? {
    id: card.id,
    productId: card.productId,
    productName: card.product.name,
    status: card.status,
    batchNo: card.batchNo,
    orderId: card.orderId,
    orderNo: card.order?.orderNo ?? null,
    soldAt: card.soldAt ? card.soldAt.toISOString() : null,
    createdAt: card.createdAt.toISOString(),
    content: card.content,
    contentPreview: previewCard(card.content),
  } : { id: input.id };
}

export async function getAdminCardsPaged(params: {
  productId?: number;
  batchNo?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}) {
  const { prisma } = getAdminContext();
  const [cards, total] = await listCardRecordsPaged(prisma, params);
  return {
    total,
    items: cards.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      status: item.status,
      batchNo: item.batchNo,
      orderId: item.orderId,
      orderNo: item.order?.orderNo ?? null,
      soldAt: item.soldAt ? item.soldAt.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
      content: item.content,
      contentPreview: previewCard(item.content),
    })),
  };
}
