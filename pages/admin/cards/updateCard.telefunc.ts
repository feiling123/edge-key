import { Abort } from "telefunc";
import { toTelefuncErrorPayload } from "../../../lib/app-error";
import { assertAdminAccess } from "../../../modules/auth/service";
import { updateCard } from "../../../modules/inventory/service";

export async function onUpdateCard(input: { id: number; productId: number; content: string; batchNo?: string }) {
  try {
    assertAdminAccess();
    return await updateCard(input);
  } catch (error) {
    throw Abort(toTelefuncErrorPayload(error));
  }
}
