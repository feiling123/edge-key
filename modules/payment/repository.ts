import type { PrismaClient } from "../../generated/prisma/client";

export function listPaymentConfigRecords(prisma: PrismaClient, providers?: readonly string[]) {
  return prisma.paymentConfig.findMany({
    where: providers?.length ? { provider: { in: [...providers] } } : undefined,
    select: {
      provider: true,
      name: true,
      isEnabled: true,
      configJson: true,
    },
    orderBy: [{ provider: "asc" }],
  });
}

export function listPaymentConfigSummaries(prisma: PrismaClient, providers?: readonly string[]) {
  return prisma.paymentConfig.findMany({
    where: providers?.length ? { provider: { in: [...providers] } } : undefined,
    select: {
      provider: true,
      name: true,
      isEnabled: true,
    },
    orderBy: [{ provider: "asc" }],
  });
}

export function getPaymentConfigRecord(prisma: PrismaClient, provider: string) {
  return prisma.paymentConfig.findUnique({
    where: { provider },
    select: {
      provider: true,
      name: true,
      isEnabled: true,
      configJson: true,
    },
  });
}

export function upsertPaymentConfigRecord(
  prisma: PrismaClient,
  provider: string,
  input: {
    name: string;
    isEnabled: boolean;
    configJson: string;
  },
) {
  return prisma.paymentConfig.upsert({
    where: { provider },
    create: {
      provider,
      name: input.name,
      isEnabled: input.isEnabled,
      configJson: input.configJson,
    },
    update: {
      name: input.name,
      isEnabled: input.isEnabled,
      configJson: input.configJson,
    },
  });
}

export function createPaymentLogRecord(
  prisma: PrismaClient,
  input: {
    orderId?: number;
    provider: string;
    orderNo?: string;
    paymentOrderNo?: string;
    eventType: string;
    rawPayload: string;
    verifyStatus?: "PENDING" | "VERIFIED" | "FAILED";
    message?: string | null;
  },
) {
  return prisma.paymentLog.create({
    data: {
      orderId: input.orderId,
      provider: input.provider,
      orderNo: input.orderNo,
      paymentOrderNo: input.paymentOrderNo,
      eventType: input.eventType,
      rawPayload: input.rawPayload,
      verifyStatus: input.verifyStatus ?? "PENDING",
      message: input.message ?? null,
    },
  });
}
