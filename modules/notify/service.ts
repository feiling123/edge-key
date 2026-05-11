import { getContext } from "telefunc";
import type { PrismaClient } from "../../generated/prisma/client";
import { badRequestError, getErrorMessage } from "../../lib/app-error";
import { logger } from "../../lib/logger";
import { validateTelegramConfigInput, validateTelegramTemplateInput, validateTestTelegramInput } from "../../lib/validators/notify";
import { getAdminContext, logAdminOperation } from "../auth/service";
import { getSiteSetting } from "../site/service";
import { createTelegramAdapter } from "./provider";
import {
  activateTelegramConfigById,
  createTelegramConfigRecord,
  createTelegramLogRecord,
  deleteTelegramConfigRecord,
  detachTelegramLogsFromConfig,
  getActiveTelegramConfigRecord,
  getTelegramConfigRecordById,
  listTelegramConfigRecords,
  listTelegramLogRecords,
  listTelegramTemplateRecords,
  updateTelegramConfigRecord,
  updatePushFlagsForAllConfigs,
  upsertTelegramTemplateRecord,
} from "./repository";
import type {
  TelegramConfigValue,
  TelegramLogItem,
  TelegramOverviewMetric,
  TelegramPushSettings,
  TelegramScene,
  TelegramTemplateValue,
} from "./types";

type TelegramConfigRecord = Awaited<ReturnType<typeof listTelegramConfigRecords>>[number];
type TelegramTemplateRecord = Awaited<ReturnType<typeof listTelegramTemplateRecords>>[number];
type TelegramLogRecord = Awaited<ReturnType<typeof listTelegramLogRecords>>[number];

const telegramScenes = ["TEST", "ORDER_PAID", "DELIVERY_SUCCESS", "DELIVERY_FAILED", "ORDER_DELETED", "ADMIN_LOGIN"] as const;

const defaultPushSettings: TelegramPushSettings = {
  notifyOrderPaid: true,
  notifyDeliverySuccess: true,
  notifyDeliveryFailed: true,
  notifyOrderDeleted: false,
  notifyAdminLogin: false,
};

const defaultTemplates: Record<TelegramScene, TelegramTemplateValue> = {
  TEST: {
    scene: "TEST",
    name: "测试通知",
    content: "Telegram 测试通知\n\n站点：{{siteName}}\n发送时间：{{sentAt}}\n\n{{customContent}}",
    isEnabled: true,
  },
  ORDER_PAID: {
    scene: "ORDER_PAID",
    name: "收款成功通知",
    content: "收款成功通知\n\n订单号：{{orderNo}}\n商品：{{productName}}\n金额：{{amount}}\n查询地址：{{queryUrl}}",
    isEnabled: true,
  },
  DELIVERY_SUCCESS: {
    scene: "DELIVERY_SUCCESS",
    name: "发货成功通知",
    content: "发货成功通知\n\n订单号：{{orderNo}}\n商品：{{productName}}\n数量：{{quantity}}\n发货内容：\n{{deliveryItems}}\n\n查询地址：{{queryUrl}}",
    isEnabled: true,
  },
  DELIVERY_FAILED: {
    scene: "DELIVERY_FAILED",
    name: "发货失败告警",
    content: "发货失败告警\n\n订单号：{{orderNo}}\n商品：{{productName}}\n失败原因：{{errorMessage}}\n查询地址：{{queryUrl}}",
    isEnabled: true,
  },
  ORDER_DELETED: {
    scene: "ORDER_DELETED",
    name: "删除订单日志",
    content: "删除订单日志\n\n网站：{{siteUrl}}\n订单号：{{orderNo}}\n客户端 IP：{{clientIp}}\n操作时间：{{sentAt}}",
    isEnabled: true,
  },
  ADMIN_LOGIN: {
    scene: "ADMIN_LOGIN",
    name: "后台登录日志",
    content: "后台登录日志\n\n网站：{{siteUrl}}\n用户名：{{username}}\n客户端 IP：{{clientIp}}\n登录时间：{{sentAt}}",
    isEnabled: true,
  },
};

function getNotifyContext() {
  return getContext<{ prisma: PrismaClient }>();
}

function normalizeTelegramConfig(record: TelegramConfigRecord): TelegramConfigValue {
  return {
    id: record.id,
    name: record.name,
    botToken: record.botToken,
    chatId: record.chatId,
    apiBaseUrl: record.apiBaseUrl || "https://api.telegram.org",
    parseMode: "NONE",
    isEnabled: record.isEnabled,
    notifyOrderPaid: record.notifyOrderPaid,
    notifyDeliverySuccess: record.notifyDeliverySuccess,
    notifyDeliveryFailed: record.notifyDeliveryFailed,
    notifyOrderDeleted: record.notifyOrderDeleted,
    notifyAdminLogin: record.notifyAdminLogin,
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt),
  };
}

function toIsoString(value: Date | string | number | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function normalizeId(value: unknown) {
  const id = typeof value === "number" ? value : Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function normalizeTelegramTemplate(record: TelegramTemplateRecord | undefined, scene: TelegramScene): TelegramTemplateValue {
  const defaults = defaultTemplates[scene];
  if (!record) return defaults;
  return {
    scene,
    name: record.name,
    content: record.content,
    isEnabled: record.isEnabled,
  };
}

function renderTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => values[key] ?? "");
}

function formatMetricValue(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function getQueryUrl(baseOrigin: string, orderNo: string, token: string) {
  const path = `/order/${encodeURIComponent(orderNo)}?token=${encodeURIComponent(token)}`;
  return baseOrigin ? `${baseOrigin}${path}` : path;
}

function buildDeliveryItems(items: string[]) {
  if (!items.length) return "暂无发货内容";
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function getGlobalPushSettings(configs: TelegramConfigValue[]): TelegramPushSettings {
  const active = configs.find((item) => item.isEnabled) ?? configs[0];
  if (!active) return { ...defaultPushSettings };
  return {
    notifyOrderPaid: active.notifyOrderPaid,
    notifyDeliverySuccess: active.notifyDeliverySuccess,
    notifyDeliveryFailed: active.notifyDeliveryFailed,
    notifyOrderDeleted: active.notifyOrderDeleted,
    notifyAdminLogin: active.notifyAdminLogin,
  };
}

async function getTelegramBaseValues(prisma: PrismaClient) {
  const site = await getSiteSetting(prisma);
  const baseOrigin = site.siteUrl?.trim().replace(/\/+$/, "") || "";
  return {
    siteName: site.siteName,
    siteUrl: baseOrigin,
    footerText: site.footerText || "",
    supportContact: site.supportContact ? `客服联系方式：${site.supportContact}` : "",
    baseOrigin,
  };
}

async function getActiveTelegramConfig(prisma: PrismaClient): Promise<TelegramConfigValue> {
  const record = await getActiveTelegramConfigRecord(prisma);
  if (!record) {
    throw badRequestError("请先启用一个 Telegram Bot 配置", "TELEGRAM_CONFIG_NOT_ENABLED");
  }
  return normalizeTelegramConfig(record);
}

async function getOptionalActiveTelegramConfig(prisma: PrismaClient, event: string) {
  try {
    return await getActiveTelegramConfig(prisma);
  } catch (error) {
    if ((error as { code?: string })?.code === "TELEGRAM_CONFIG_NOT_ENABLED") {
      return null;
    }
    logger.error(error instanceof Error ? error : String(error), { event });
    return null;
  }
}

async function createLog(prisma: PrismaClient, input: {
  orderId?: number;
  configId?: number | null;
  scene: TelegramScene;
  status: "SUCCESS" | "FAILED";
  chatId: string;
  message: string;
  telegramMessageId?: string;
  error?: string;
  triggeredBy?: string;
}) {
  await createTelegramLogRecord(prisma, {
    orderId: input.orderId,
    configId: input.configId ?? null,
    scene: input.scene,
    status: input.status,
    chatId: input.chatId,
    message: input.message,
    telegramMessageId: input.telegramMessageId ?? null,
    error: input.error ?? null,
    triggeredBy: input.triggeredBy ?? null,
  });
}

async function sendSceneTelegram(prisma: PrismaClient, input: {
  scene: TelegramScene;
  orderId?: number;
  triggeredBy?: string;
  values?: Record<string, string>;
  config?: TelegramConfigValue;
  chatId?: string;
}) {
  const config = input.config ?? await getActiveTelegramConfig(prisma);
  const templates = await listTelegramTemplateRecords(prisma);
  const template = normalizeTelegramTemplate(
    templates.find((item: TelegramTemplateRecord) => item.scene === input.scene),
    input.scene,
  );
  if (!template.isEnabled) {
    return { skipped: true, reason: "template_disabled" };
  }

  const baseValues = await getTelegramBaseValues(prisma);
  const text = renderTemplate(template.content, {
    siteName: baseValues.siteName,
    siteUrl: baseValues.siteUrl,
    footerText: baseValues.footerText,
    supportContact: baseValues.supportContact,
    sentAt: new Date().toISOString(),
    ...(input.values ?? {}),
  });
  const chatId = input.chatId?.trim() || config.chatId;

  try {
    const adapter = createTelegramAdapter(config);
    const result = await adapter.send({ chatId, text, parseMode: config.parseMode });
    await createLog(prisma, {
      orderId: input.orderId,
      configId: config.id ?? null,
      scene: input.scene,
      status: "SUCCESS",
      chatId,
      message: text,
      telegramMessageId: result.messageId,
      triggeredBy: input.triggeredBy,
    });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    const message = getErrorMessage(error, "Telegram 通知发送失败");
    await createLog(prisma, {
      orderId: input.orderId,
      configId: config.id ?? null,
      scene: input.scene,
      status: "FAILED",
      chatId,
      message: text,
      error: message,
      triggeredBy: input.triggeredBy,
    });
    logger.error(error instanceof Error ? error : message, {
      event: "telegram.send.failed",
      scene: input.scene,
      orderId: input.orderId,
      configId: config.id,
    });
    throw error;
  }
}

export async function getTelegramManagementData(prisma?: PrismaClient) {
  const client = prisma ?? getNotifyContext().prisma;
  const [configRecords, templateRecords, logRecords] = await Promise.all([
    listTelegramConfigRecords(client),
    listTelegramTemplateRecords(client),
    listTelegramLogRecords(client, 100),
  ]);

  const configs = configRecords.map((record: TelegramConfigRecord) => normalizeTelegramConfig(record));
  const templates = telegramScenes.map((scene) =>
    normalizeTelegramTemplate(
      templateRecords.find((item: TelegramTemplateRecord) => item.scene === scene),
      scene,
    )
  );

  const statsMap = {
    configs: configs.length,
    success: logRecords.filter((item: TelegramLogRecord) => item.status === "SUCCESS").length,
    failed: logRecords.filter((item: TelegramLogRecord) => item.status === "FAILED").length,
    test: logRecords.filter((item: TelegramLogRecord) => item.scene === "TEST").length,
  };

  const metrics: TelegramOverviewMetric[] = [
    { label: "Bot 配置", value: formatMetricValue(statsMap.configs) },
    { label: "发送成功", value: formatMetricValue(statsMap.success) },
    { label: "发送失败", value: formatMetricValue(statsMap.failed) },
    { label: "测试通知", value: formatMetricValue(statsMap.test) },
  ];

  const logs: TelegramLogItem[] = logRecords.map((item: TelegramLogRecord) => ({
    id: item.id,
    configId: item.configId,
    configName: item.config?.name ?? null,
    scene: item.scene as TelegramScene,
    status: item.status as "SUCCESS" | "FAILED",
    chatId: item.chatId,
    message: item.message,
    telegramMessageId: item.telegramMessageId,
    error: item.error,
    triggeredBy: item.triggeredBy,
    createdAt: toIsoString(item.createdAt),
  }));

  return {
    configs,
    templates,
    logs,
    metrics,
    pushSettings: getGlobalPushSettings(configs),
  };
}

export async function saveTelegramPushSettings(input: TelegramPushSettings) {
  const context = getAdminContext();
  const flags = {
    notifyOrderPaid: Boolean(input.notifyOrderPaid),
    notifyDeliverySuccess: Boolean(input.notifyDeliverySuccess),
    notifyDeliveryFailed: Boolean(input.notifyDeliveryFailed),
    notifyOrderDeleted: Boolean(input.notifyOrderDeleted),
    notifyAdminLogin: Boolean(input.notifyAdminLogin),
  };

  await updatePushFlagsForAllConfigs(context.prisma, flags);
  await logAdminOperation({
    action: "UPDATE_TELEGRAM_PUSH_SETTINGS",
    targetType: "TelegramConfig",
    detail: JSON.stringify(flags),
  });

  return flags;
}

export async function activateTelegramConfig(id: number) {
  const context = getAdminContext();
  const record = await getTelegramConfigRecordById(context.prisma, id);
  if (!record) {
    throw badRequestError("Telegram Bot 配置不存在", "TELEGRAM_CONFIG_NOT_FOUND");
  }

  const updated = await activateTelegramConfigById(context.prisma, id);
  await logAdminOperation({
    action: "ACTIVATE_TELEGRAM_CONFIG",
    targetType: "TelegramConfig",
    targetId: String(id),
  });
  return normalizeTelegramConfig(updated);
}

export async function saveTelegramConfig(input: TelegramConfigValue) {
  const context = getAdminContext();
  const validated = validateTelegramConfigInput(input);
  const configId = normalizeId(input.id);
  const existingConfigs = await listTelegramConfigRecords(context.prisma);
  const shouldEnable = configId ? validated.isEnabled : (validated.isEnabled || existingConfigs.length === 0);
  const data = {
    name: validated.name || `Telegram ${validated.chatId}`,
    botToken: validated.botToken,
    chatId: validated.chatId,
    apiBaseUrl: validated.apiBaseUrl,
    parseMode: "NONE",
    isEnabled: shouldEnable,
    notifyOrderPaid: validated.notifyOrderPaid,
    notifyDeliverySuccess: validated.notifyDeliverySuccess,
    notifyDeliveryFailed: validated.notifyDeliveryFailed,
    notifyOrderDeleted: validated.notifyOrderDeleted,
    notifyAdminLogin: validated.notifyAdminLogin,
  };

  if (shouldEnable) {
    await context.prisma.telegramConfig.updateMany({ data: { isEnabled: false } });
  }

  if (configId) {
    const existing = await getTelegramConfigRecordById(context.prisma, configId);
    if (!existing) {
      throw badRequestError("Telegram Bot 配置不存在", "TELEGRAM_CONFIG_NOT_FOUND");
    }
    const record = await updateTelegramConfigRecord(context.prisma, configId, data);
    await logAdminOperation({
      action: "UPDATE_TELEGRAM_CONFIG",
      targetType: "TelegramConfig",
      targetId: String(configId),
      detail: data.name,
    });
    return normalizeTelegramConfig(record);
  }

  const record = await createTelegramConfigRecord(context.prisma, data);
  await logAdminOperation({
    action: "CREATE_TELEGRAM_CONFIG",
    targetType: "TelegramConfig",
    targetId: String(record.id),
    detail: data.name,
  });
  return normalizeTelegramConfig(record);
}

export async function deleteTelegramConfig(id: number) {
  const context = getAdminContext();
  const record = await getTelegramConfigRecordById(context.prisma, id);
  if (!record) {
    throw badRequestError("Telegram Bot 配置不存在", "TELEGRAM_CONFIG_NOT_FOUND");
  }

  await detachTelegramLogsFromConfig(context.prisma, id);
  await deleteTelegramConfigRecord(context.prisma, id);
  await logAdminOperation({
    action: "DELETE_TELEGRAM_CONFIG",
    targetType: "TelegramConfig",
    targetId: String(id),
    detail: record.name,
  });

  return { success: true };
}

export async function saveTelegramTemplate(input: TelegramTemplateValue) {
  const context = getAdminContext();
  const validated = validateTelegramTemplateInput(input);
  const record = await upsertTelegramTemplateRecord(context.prisma, validated.scene, {
    name: validated.name,
    content: validated.content,
    isEnabled: validated.isEnabled,
  });

  await logAdminOperation({
    action: "UPDATE_TELEGRAM_TEMPLATE",
    targetType: "TelegramTemplate",
    targetId: validated.scene,
    detail: validated.name,
  });

  return normalizeTelegramTemplate(record, validated.scene);
}

export async function sendTestTelegram(input: {
  chatId?: string;
  customContent?: string;
  configId?: number;
}) {
  const context = getAdminContext();
  const validated = validateTestTelegramInput(input);
  let config: TelegramConfigValue | undefined;

  if (input.configId) {
    const record = await getTelegramConfigRecordById(context.prisma, input.configId);
    if (!record) {
      throw badRequestError("指定的 Telegram Bot 配置不存在", "TELEGRAM_CONFIG_NOT_FOUND");
    }
    config = normalizeTelegramConfig(record);
  }

  const result = await sendSceneTelegram(context.prisma, {
    scene: "TEST",
    config,
    chatId: validated.chatId,
    triggeredBy: "admin_test",
    values: {
      customContent: validated.customContent,
    },
  });

  await logAdminOperation({
    action: "SEND_TELEGRAM_TEST",
    targetType: "TelegramLog",
    detail: `chatId=${validated.chatId || config?.chatId || "active"}`,
  });

  return result;
}

export async function clearTelegramLogs() {
  const context = getAdminContext();
  const result = await context.prisma.telegramLog.deleteMany();
  const count = typeof result.count === "number" ? result.count : 0;

  await logAdminOperation({
    action: "CLEAR_TELEGRAM_LOGS",
    targetType: "TelegramLog",
    detail: `deleted ${count} records`,
  });

  return { count };
}

export async function notifyOrderPaid(input: {
  prisma?: PrismaClient;
  orderId: number;
  orderNo: string;
  queryToken: string;
  productName: string;
  amount: number;
}) {
  const prisma = input.prisma ?? getNotifyContext().prisma;
  const config = await getOptionalActiveTelegramConfig(prisma, "telegram.notify_order_paid.config_failed");
  if (!config || !config.notifyOrderPaid) return { skipped: true };

  const baseValues = await getTelegramBaseValues(prisma);
  return sendSceneTelegram(prisma, {
    scene: "ORDER_PAID",
    config,
    orderId: input.orderId,
    triggeredBy: "payment_notify",
    values: {
      orderNo: input.orderNo,
      productName: input.productName,
      amount: (input.amount / 100).toFixed(2),
      queryUrl: getQueryUrl(baseValues.baseOrigin, input.orderNo, input.queryToken),
    },
  });
}

export async function notifyDeliverySuccess(input: {
  prisma?: PrismaClient;
  orderId: number;
  orderNo: string;
  queryToken: string;
  productName: string;
  quantity: number;
  items: string[];
}) {
  const prisma = input.prisma ?? getNotifyContext().prisma;
  const config = await getOptionalActiveTelegramConfig(prisma, "telegram.notify_delivery_success.config_failed");
  if (!config || !config.notifyDeliverySuccess) return { skipped: true };

  const baseValues = await getTelegramBaseValues(prisma);
  return sendSceneTelegram(prisma, {
    scene: "DELIVERY_SUCCESS",
    config,
    orderId: input.orderId,
    triggeredBy: "delivery_success",
    values: {
      orderNo: input.orderNo,
      productName: input.productName,
      quantity: String(input.quantity),
      deliveryItems: buildDeliveryItems(input.items),
      queryUrl: getQueryUrl(baseValues.baseOrigin, input.orderNo, input.queryToken),
    },
  });
}

export async function notifyDeliveryFailed(input: {
  prisma?: PrismaClient;
  orderId: number;
  orderNo: string;
  queryToken: string;
  productName: string;
  errorMessage: string;
}) {
  const prisma = input.prisma ?? getNotifyContext().prisma;
  const config = await getOptionalActiveTelegramConfig(prisma, "telegram.notify_delivery_failed.config_failed");
  if (!config || !config.notifyDeliveryFailed) return { skipped: true };

  const baseValues = await getTelegramBaseValues(prisma);
  return sendSceneTelegram(prisma, {
    scene: "DELIVERY_FAILED",
    config,
    orderId: input.orderId,
    triggeredBy: "delivery_failed",
    values: {
      orderNo: input.orderNo,
      productName: input.productName,
      errorMessage: input.errorMessage,
      queryUrl: getQueryUrl(baseValues.baseOrigin, input.orderNo, input.queryToken),
    },
  });
}

export async function notifyOrderDeleted(input: {
  prisma?: PrismaClient;
  orderNo: string;
  clientIp?: string;
  siteUrl?: string;
  triggeredBy?: string;
}) {
  const prisma = input.prisma ?? getNotifyContext().prisma;
  const config = await getOptionalActiveTelegramConfig(prisma, "telegram.notify_order_deleted.config_failed");
  if (!config || !config.notifyOrderDeleted) return { skipped: true };

  const baseValues = await getTelegramBaseValues(prisma);
  return sendSceneTelegram(prisma, {
    scene: "ORDER_DELETED",
    config,
    triggeredBy: input.triggeredBy || "admin_order_delete",
    values: {
      siteUrl: input.siteUrl?.trim() || baseValues.siteUrl || "-",
      orderNo: input.orderNo,
      clientIp: input.clientIp?.trim() || "unknown",
    },
  });
}

export async function notifyAdminLogin(input: {
  prisma?: PrismaClient;
  username?: string;
  clientIp?: string;
  siteUrl?: string;
}) {
  const prisma = input.prisma ?? getNotifyContext().prisma;
  const config = await getOptionalActiveTelegramConfig(prisma, "telegram.notify_admin_login.config_failed");
  if (!config || !config.notifyAdminLogin) return { skipped: true };

  const baseValues = await getTelegramBaseValues(prisma);
  return sendSceneTelegram(prisma, {
    scene: "ADMIN_LOGIN",
    config,
    triggeredBy: "admin_login",
    values: {
      siteUrl: input.siteUrl?.trim() || baseValues.siteUrl || "-",
      username: input.username?.trim() || "admin",
      clientIp: input.clientIp?.trim() || "unknown",
    },
  });
}
