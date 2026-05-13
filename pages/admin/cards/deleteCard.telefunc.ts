import { Abort } from "telefunc";
import { toTelefuncErrorPayload } from "../../../lib/app-error";
import { assertAdminAccess } from "../../../modules/auth/service";
import { deleteCard } from "../../../modules/inventory/service";

export async function onDeleteCard(input: { id: number }) {
  try {
    assertAdminAccess();
    return await deleteCard(input);
  } catch (error) {
    throw Abort(toTelefuncErrorPayload(error));
  }
}
