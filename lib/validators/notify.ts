import { badRequestError } from "../app-error";

const telegramScenes = ["TEST", "ORDER_PAID", "DELIVERY_SUCCESS", "DELIVERY_FAILED", "ORDER_DELETED", "ADMIN_LOGIN"] as const;
const telegramParseModes = ["NONE", "HTML", "MARKDOWN_V2"] as const;

function normalizeTelegramToken(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeChatId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeApiBaseUrl(value: unknown) {
  const input = typeof value === "string" && value.trim() ? value.trim() : "https://api.telegram.org";
  try {
    return new URL(input).toString().replace(/\/+$/, "");
  } catch {
    throw badRequestError("Telegram API 地址格式不正确", "TELEGRAM_API_BASE_URL_INVALID");
  }
}

export function validateTelegramConfigInput(input: any) {
  const botToken = normalizeTelegramToken(input.botToken);
  if (!botToken) {
    throw badRequestError("Telegram Bot Token 不能为空", "TELEGRAM_BOT_TOKEN_REQUIRED");
  }

  if (!botToken.includes(":") || botToken.length < 30) {
    throw badRequestError("Telegram Bot Token 格式不正确", "TELEGRAM_BOT_TOKEN_INVALID");
  }

  const chatId = normalizeChatId(input.chatId);
  if (!chatId) {
    throw badRequestError("Telegram Chat ID 不能为空", "TELEGRAM_CHAT_ID_REQUIRED");
  }

  if (chatId.length > 128) {
    throw badRequestError("Telegram Chat ID 不能超过 128 个字符", "TELEGRAM_CHAT_ID_TOO_LONG");
  }

  const parseMode = String(input.parseMode || "NONE").trim().toUpperCase();
  if (!telegramParseModes.includes(parseMode as any)) {
    throw badRequestError("Telegram Parse Mode 不正确", "TELEGRAM_PARSE_MODE_INVALID");
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length > 80) {
    throw badRequestError("配置名称不能超过 80 个字符", "TELEGRAM_CONFIG_NAME_TOO_LONG");
  }

  return {
    name,
    botToken,
    chatId,
    apiBaseUrl: normalizeApiBaseUrl(input.apiBaseUrl),
    parseMode: "NONE" as const,
    isEnabled: Boolean(input.isEnabled),
    notifyOrderPaid: input.notifyOrderPaid !== false,
    notifyDeliverySuccess: input.notifyDeliverySuccess !== false,
    notifyDeliveryFailed: input.notifyDeliveryFailed !== false,
    notifyOrderDeleted: Boolean(input.notifyOrderDeleted),
    notifyAdminLogin: Boolean(input.notifyAdminLogin),
  };
}

export function validateTelegramTemplateInput(input: {
  scene?: string;
  name?: string;
  content?: string;
  isEnabled?: boolean;
}) {
  const scene = input.scene?.trim().toUpperCase() || "";
  if (!telegramScenes.includes(scene as any)) {
    throw badRequestError("Telegram 模板场景不正确", "TELEGRAM_TEMPLATE_SCENE_INVALID");
  }

  const name = input.name?.trim() || "";
  if (!name) {
    throw badRequestError("模板名称不能为空", "TELEGRAM_TEMPLATE_NAME_REQUIRED");
  }

  const content = input.content?.trim() || "";
  if (!content) {
    throw badRequestError("Telegram 消息内容不能为空", "TELEGRAM_TEMPLATE_CONTENT_REQUIRED");
  }

  return {
    scene: scene as (typeof telegramScenes)[number],
    name,
    content,
    isEnabled: input.isEnabled !== false,
  };
}

export function validateTestTelegramInput(input: {
  chatId?: string;
  customContent?: string;
}) {
  const chatId = normalizeChatId(input.chatId);
  if (chatId.length > 128) {
    throw badRequestError("Telegram Chat ID 不能超过 128 个字符", "TELEGRAM_CHAT_ID_TOO_LONG");
  }

  return {
    chatId: chatId || undefined,
    customContent: input.customContent?.trim() || "",
  };
}
