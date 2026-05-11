import type { PrismaClient } from "../../generated/prisma/client";
import type { PaymentProvider } from "../payment/types";

export function findOrderRecord(prisma: PrismaClient, orderNo: string) {
  return prisma.order.findUnique({
    where: { orderNo },
  });
}

export function findOrderWithProduct(prisma: PrismaClient, orderNo: string) {
  return prisma.order.findUnique({
    where: { orderNo },
    include: {
      product: true,
      deliveries: true,
      cards: true,
    },
  });
}

export function listOrderRecords(prisma: PrismaClient) {
  return prisma.order.findMany({
    orderBy: [{ id: "desc" }],
    include: {
      product: true,
      deliveries: true,
    },
  });
}

export function findOrderById(prisma: PrismaClient, id: number) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      product: true,
      deliveries: true,
      cards: true,
      paymentLogs: true,
    },
  });
}

export function createOrderRecord(
  prisma: PrismaClient,
  input: {
    orderNo: string;
    queryToken: string;
    productId: number;
    productNameSnapshot: string;
    unitPrice: number;
    quantity: number;
    amount: number;
    contactType: "EMAIL" | "QQ" | "TELEGRAM" | "OTHER";
    contactValue?: string | null;
    buyerNote?: string | null;
    paymentProvider: PaymentProvider;
    paymentChannel?: string | null;
  },
) {
  return prisma.order.create({
    data: {
      orderNo: input.orderNo,
      queryToken: input.queryToken,
      productId: input.productId,
      productNameSnapshot: input.productNameSnapshot,
      unitPrice: input.unitPrice,
      quantity: input.quantity,
      amount: input.amount,
      contactType: input.contactType,
      contactValue: input.contactValue ?? null,
      buyerNote: input.buyerNote ?? null,
      paymentProvider: input.paymentProvider,
      paymentChannel: input.paymentChannel ?? null,
    },
  });
}

export async function updateOrderPayment(prisma: PrismaClient, orderNo: string, input: {
  paymentOrderNo?: string | null;
  status: "PENDING" | "PAID" | "DELIVERED" | "CLOSED" | "FAILED";
  paymentStatus: "UNPAID" | "PAID" | "FAILED";
  paidAt?: Date | null;
}) {
  const allowedPreviousPaymentStatus = input.paymentStatus === "PAID" ? ["UNPAID", "FAILED"] : ["UNPAID"];
  const result = await prisma.order.updateMany({
    where: {
      orderNo,
      paymentStatus: { in: allowedPreviousPaymentStatus as Array<"UNPAID" | "FAILED"> },
    },
    data: {
      paymentOrderNo: input.paymentOrderNo ?? null,
      status: input.status,
      paymentStatus: input.paymentStatus,
      paidAt: input.paidAt ?? null,
    },
  });
  return result.count > 0;
}

export function updateOrderDeliveryState(
  prisma: PrismaClient,
  orderNo: string,
  input: {
    status: "PENDING" | "PAID" | "DELIVERED" | "CLOSED" | "FAILED";
    deliveryStatus: "NOT_DELIVERED" | "DELIVERED" | "FAILED";
    deliveredAt?: Date | null;
  },
) {
  return prisma.order.update({
    where: { orderNo },
    data: {
      status: input.status,
      deliveryStatus: input.deliveryStatus,
      deliveredAt: input.deliveredAt ?? null,
    },
  });
}

export function closeOrderRecord(prisma: PrismaClient, id: number) {
  return prisma.order.update({
    where: { id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
    },
  });
}

export async function deleteOrderRecords(prisma: PrismaClient, ids: number[]) {
  if (!ids.length) return { count: 0 };
  const orders = await prisma.order.findMany({
    where: { id: { in: ids } },
    select: { orderNo: true },
  });
  const orderNos = orders.map((order) => order.orderNo).filter(Boolean);

  await prisma.orderDelivery.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.paymentLog.deleteMany({
    where: {
      OR: [
        { orderId: { in: ids } },
        ...(orderNos.length ? [{ orderNo: { in: orderNos } }] : []),
      ],
    },
  });
  await prisma.telegramLog.updateMany({ where: { orderId: { in: ids } }, data: { orderId: null } });
  await prisma.card.updateMany({
    where: {
      orderId: { in: ids },
      status: "LOCKED",
    },
    data: {
      status: "UNUSED",
      orderId: null,
      soldAt: null,
      deliveryLockToken: null,
    },
  });
  await prisma.card.updateMany({
    where: {
      orderId: { in: ids },
      status: { not: "LOCKED" },
    },
    data: {
      orderId: null,
      deliveryLockToken: null,
    },
  });
  return prisma.order.deleteMany({ where: { id: { in: ids } } });
}
