import { Abort } from "telefunc";
import { toTelefuncErrorPayload } from "../../../lib/app-error";
import { assertAdminAccess } from "../../../modules/auth/service";
import { deleteCards } from "../../../modules/inventory/service";

export async function onDeleteCards(input: { ids: number[] }) {
  try {
    assertAdminAccess();
    return await deleteCards(input);
  } catch (error) {
    throw Abort(toTelefuncErrorPayload(error));
  }
}
