import { Abort } from "telefunc";
import { toTelefuncErrorPayload } from "../../../lib/app-error";
import { assertAdminAccess } from "../../../modules/auth/service";
import { createCard } from "../../../modules/inventory/service";

export async function onCreateCard(input: { productId: number; content: string; batchNo?: string }) {
  try {
    assertAdminAccess();
    return await createCard(input);
  } catch (error) {
    throw Abort(toTelefuncErrorPayload(error));
  }
}
