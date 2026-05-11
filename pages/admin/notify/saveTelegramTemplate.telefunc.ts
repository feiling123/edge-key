import { Abort } from "telefunc";
import { toTelefuncErrorPayload } from "../../../lib/app-error";
import { assertAdminAccess } from "../../../modules/auth/service";
import { saveTelegramTemplate } from "../../../modules/notify/service";

export async function onSaveTelegramTemplate(input: {
  scene: "TEST" | "ORDER_PAID" | "DELIVERY_SUCCESS" | "DELIVERY_FAILED" | "ORDER_DELETED" | "ADMIN_LOGIN";
  name: string;
  content: string;
  isEnabled: boolean;
}) {
  try {
    assertAdminAccess();
    return await saveTelegramTemplate(input);
  } catch (error) {
    throw Abort(toTelefuncErrorPayload(error));
  }
}
