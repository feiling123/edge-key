import { getContext } from "telefunc";
import type { PrismaClient } from "../../generated/prisma/client";
import { badRequestError } from "../../lib/app-error";
import { getAdminContext, logAdminOperation } from "../auth/service";
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
import { deleteOrders } from "../order/service";

function getInventoryContext() {
  return getContext<{ prisma: PrismaClient }>();
}

function previewCard(content: string) {
  if (content.length <= 8) {
    return content;
  }

  return `${content.slice(0, 4)}****${content.slice(-4)}`;
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
  const content = input.content.trim();

  if (!content) {
    throw badRequestError("卡密内容不能为空", "CARD_CONTENT_REQUIRED");
  }

  const card = await createCardRecord(prisma, {
    productId: input.productId,
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
  const items = parseCardLines(input.lines);

  if (!items.length) {
    throw badRequestError("没有可导入的卡密内容", "CARD_IMPORT_EMPTY");
  }

  await createManyCards(
    prisma,
    items.map((content) => ({
      productId: input.productId,
      content,
      batchNo: input.batchNo?.trim() || null,
    })),
  );

  await logAdminOperation(
    {
      action: "IMPORT_CARDS",
      targetType: "Card",
      targetId: String(input.productId),
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
  const result = await deleteUnusedCardsByProduct(prisma, input.productId);

  await logAdminOperation(
    {
      action: "DELETE_UNUSED_CARDS",
      targetType: "Card",
      targetId: String(input.productId),
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
  const card = await findCardById(prisma, input.id);
  let idsToDelete = [input.id];
  if (card?.orderId) {
    const orderCards = await findCardsByOrderIds(prisma, [card.orderId]);
    idsToDelete = [...new Set([...idsToDelete, ...orderCards.map((item) => item.id)])];
    await deleteOrders({ ids: [card.orderId] });
  }
  const result = await deleteCardsByIds(prisma, idsToDelete);
  if (result.count === 0) throw badRequestError("卡密不存在或锁定中，无法删除", "CARD_DELETE_FAILED");
  await logAdminOperation({ action: "DELETE_CARD", targetType: "Card", targetId: String(input.id), detail: "" }, { prisma, adminId });
  return { id: input.id };
}

export async function deleteCards(input: { ids: number[] }) {
  const adminContext = getAdminContext();
  const { prisma } = adminContext;
  const adminId = Number(adminContext.session?.user?.id);
  const ids = [...new Set(input.ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) throw badRequestError("请选择要删除的卡密", "CARD_IDS_REQUIRED");

  const cards = await findCardsByIds(prisma, ids);
  const orderIds = [...new Set(cards.map((item) => item.orderId).filter((id): id is number => typeof id === "number" && id > 0))];
  let idsToDelete = ids;
  if (orderIds.length) {
    const orderCards = await findCardsByOrderIds(prisma, orderIds);
    idsToDelete = [...new Set([...idsToDelete, ...orderCards.map((item) => item.id)])];
    await deleteOrders({ ids: orderIds });
  }
  const result = await deleteCardsByIds(prisma, idsToDelete);
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
  const productId = Number(input.productId);

  if (!Number.isInteger(input.id) || input.id <= 0) {
    throw badRequestError("卡密 ID 无效", "CARD_ID_INVALID");
  }

  if (!Number.isInteger(productId) || productId <= 0) {
    throw badRequestError("请选择商品", "CARD_PRODUCT_REQUIRED");
  }

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
      soldAt: item.soldAt ? item.soldAt.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
      content: item.content,
      contentPreview: previewCard(item.content),
    })),
  };
}
