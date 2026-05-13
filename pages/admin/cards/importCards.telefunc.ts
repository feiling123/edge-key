import { Abort } from "telefunc";
import { toTelefuncErrorPayload } from "../../../lib/app-error";
import { assertAdminAccess } from "../../../modules/auth/service";
import { importCards } from "../../../modules/inventory/service";

export async function onImportCards(input: { productId: number; lines: string; batchNo?: string }) {
  try {
    assertAdminAccess();
    return await importCards(input);
  } catch (error) {
    throw Abort(toTelefuncErrorPayload(error));
  }
}
