import { Abort } from "telefunc";
import { toTelefuncErrorPayload } from "../../../lib/app-error";
import { assertAdminAccess } from "../../../modules/auth/service";
import { activateTelegramConfig, clearTelegramLogs, deleteTelegramConfig, saveTelegramConfig, saveTelegramPushSettings } from "../../../modules/notify/service";

type SaveTelegramConfigInput = {
  id?: number;
  name?: string;
  botToken: string;
  chatId: string;
  apiBaseUrl?: string;
  parseMode?: "NONE" | "HTML" | "MARKDOWN_V2";
  isEnabled?: boolean;
  notifyOrderPaid?: boolean;
  notifyDeliverySuccess?: boolean;
  notifyDeliveryFailed?: boolean;
  notifyOrderDeleted?: boolean;
  notifyAdminLogin?: boolean;
};

export async function onSaveTelegramConfig(input: SaveTelegramConfigInput) {
  return runNotifyTelefunc(async () => {
    assertAdminAccess();
    return saveTelegramConfig(input as any);
  });
}

export async function onDeleteTelegramConfig(id: number) {
  return runNotifyTelefunc(async () => {
    assertAdminAccess();
    return deleteTelegramConfig(id);
  });
}

export async function onSaveTelegramPushSettings(input: {
  notifyOrderPaid: boolean;
  notifyDeliverySuccess: boolean;
  notifyDeliveryFailed: boolean;
  notifyOrderDeleted: boolean;
  notifyAdminLogin: boolean;
}) {
  return runNotifyTelefunc(async () => {
    assertAdminAccess();
    return saveTelegramPushSettings(input);
  });
}

export async function onActivateTelegramConfig(id: number) {
  return runNotifyTelefunc(async () => {
    assertAdminAccess();
    return activateTelegramConfig(id);
  });
}

export async function onClearTelegramLogs() {
  return runNotifyTelefunc(async () => {
    assertAdminAccess();
    return clearTelegramLogs();
  });
}

async function runNotifyTelefunc<T>(handler: () => Promise<T>) {
  try {
    return await handler();
  } catch (error) {
    throw Abort(toTelefuncErrorPayload(error));
  }
}
