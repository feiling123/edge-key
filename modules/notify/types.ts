export type TelegramScene = "TEST" | "ORDER_PAID" | "DELIVERY_SUCCESS" | "DELIVERY_FAILED" | "ORDER_DELETED" | "ADMIN_LOGIN";

export type TelegramSendStatus = "SUCCESS" | "FAILED";

export type TelegramParseMode = "NONE" | "HTML" | "MARKDOWN_V2";

export interface TelegramPushSettings {
  notifyOrderPaid: boolean;
  notifyDeliverySuccess: boolean;
  notifyDeliveryFailed: boolean;
  notifyOrderDeleted: boolean;
  notifyAdminLogin: boolean;
}

export interface TelegramConfigValue extends TelegramPushSettings {
  id?: number;
  name?: string;
  botToken: string;
  chatId: string;
  apiBaseUrl: string;
  parseMode: TelegramParseMode;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TelegramTemplateValue {
  scene: TelegramScene;
  name: string;
  content: string;
  isEnabled: boolean;
}

export interface TelegramLogItem {
  id: number;
  configId?: number | null;
  configName?: string | null;
  scene: TelegramScene;
  status: TelegramSendStatus;
  chatId: string;
  message: string;
  telegramMessageId?: string | null;
  error?: string | null;
  triggeredBy?: string | null;
  createdAt: string;
}

export interface TelegramOverviewMetric {
  label: string;
  value: string;
}

export interface TelegramSendInput {
  chatId: string;
  text: string;
  parseMode?: TelegramParseMode;
}

export interface TelegramSendResult {
  messageId?: string;
  raw?: unknown;
}

export interface TelegramProviderAdapter {
  send(input: TelegramSendInput): Promise<TelegramSendResult>;
}
