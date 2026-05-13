import { Abort } from "telefunc";
import { toTelefuncErrorPayload } from "../../../lib/app-error";
import { assertAdminAccess } from "../../../modules/auth/service";
import { deleteUnusedCards } from "../../../modules/inventory/service";

export async function onDeleteUnusedCards(input: { productId: number }) {
  try {
    assertAdminAccess();
    return await deleteUnusedCards(input);
  } catch (error) {
    throw Abort(toTelefuncErrorPayload(error));
  }
}
