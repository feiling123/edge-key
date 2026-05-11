import type { PrismaClient } from "../../generated/prisma/client";
import type { TelegramScene } from "./types";

export function listTelegramConfigRecords(prisma: PrismaClient) {
  return prisma.telegramConfig.findMany({
    orderBy: [{ id: "asc" }],
  });
}

export function getTelegramConfigRecordById(prisma: PrismaClient, id: number) {
  return prisma.telegramConfig.findUnique({
    where: { id },
  });
}

export function getActiveTelegramConfigRecord(prisma: PrismaClient) {
  return prisma.telegramConfig.findFirst({
    where: { isEnabled: true },
    orderBy: [{ id: "asc" }],
  });
}

export function createTelegramConfigRecord(
  prisma: PrismaClient,
  input: {
    name: string;
    botToken: string;
    chatId: string;
    apiBaseUrl: string;
    parseMode: string;
    isEnabled: boolean;
    notifyOrderPaid: boolean;
    notifyDeliverySuccess: boolean;
    notifyDeliveryFailed: boolean;
    notifyOrderDeleted: boolean;
    notifyAdminLogin: boolean;
  },
) {
  return prisma.telegramConfig.create({
    data: {
      ...input,
      updatedAt: new Date(),
    },
  });
}

export function updateTelegramConfigRecord(
  prisma: PrismaClient,
  id: number,
  input: Partial<{
    name: string;
    botToken: string;
    chatId: string;
    apiBaseUrl: string;
    parseMode: string;
    isEnabled: boolean;
    notifyOrderPaid: boolean;
    notifyDeliverySuccess: boolean;
    notifyDeliveryFailed: boolean;
    notifyOrderDeleted: boolean;
    notifyAdminLogin: boolean;
  }>,
) {
  return prisma.telegramConfig.update({
    where: { id },
    data: {
      ...input,
      updatedAt: new Date(),
    },
  });
}

export function deleteTelegramConfigRecord(prisma: PrismaClient, id: number) {
  return prisma.telegramConfig.delete({
    where: { id },
  });
}

export async function detachTelegramLogsFromConfig(prisma: PrismaClient, configId: number) {
  return prisma.telegramLog.updateMany({
    where: { configId },
    data: { configId: null },
  });
}

export async function activateTelegramConfigById(prisma: PrismaClient, id: number) {
  const now = new Date();
  await prisma.telegramConfig.updateMany({
    where: { id: { not: id } },
    data: { isEnabled: false, updatedAt: now },
  });
  return prisma.telegramConfig.update({
    where: { id },
    data: { isEnabled: true, updatedAt: now },
  });
}

export async function updatePushFlagsForAllConfigs(
  prisma: PrismaClient,
  flags: {
    notifyOrderPaid: boolean;
    notifyDeliverySuccess: boolean;
    notifyDeliveryFailed: boolean;
    notifyOrderDeleted: boolean;
    notifyAdminLogin: boolean;
  },
) {
  await prisma.telegramConfig.updateMany({
    data: {
      ...flags,
      updatedAt: new Date(),
    },
  });
}

export function listTelegramTemplateRecords(prisma: PrismaClient) {
  return prisma.telegramTemplate.findMany({
    orderBy: [{ scene: "asc" }],
  });
}

export function upsertTelegramTemplateRecord(
  prisma: PrismaClient,
  scene: TelegramScene,
  input: {
    name: string;
    content: string;
    isEnabled: boolean;
  },
) {
  return prisma.telegramTemplate.upsert({
    where: { scene },
    create: {
      scene,
      name: input.name,
      content: input.content,
      isEnabled: input.isEnabled,
      updatedAt: new Date(),
    },
    update: {
      name: input.name,
      content: input.content,
      isEnabled: input.isEnabled,
      updatedAt: new Date(),
    },
  });
}

export function listTelegramLogRecords(prisma: PrismaClient, limit = 100) {
  return prisma.telegramLog.findMany({
    include: { config: true },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
  });
}

export function createTelegramLogRecord(
  prisma: PrismaClient,
  input: {
    orderId?: number;
    configId?: number | null;
    scene: TelegramScene;
    status: "SUCCESS" | "FAILED";
    chatId: string;
    message: string;
    telegramMessageId?: string | null;
    error?: string | null;
    triggeredBy?: string | null;
  },
) {
  return prisma.telegramLog.create({
    data: {
      orderId: input.orderId,
      configId: input.configId ?? null,
      scene: input.scene,
      status: input.status,
      chatId: input.chatId,
      message: input.message,
      telegramMessageId: input.telegramMessageId ?? null,
      error: input.error ?? null,
      triggeredBy: input.triggeredBy ?? null,
    },
  });
}
