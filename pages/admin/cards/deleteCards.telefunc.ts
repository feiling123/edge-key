import { assertAdminAccess } from "../../../modules/auth/service";
import { deleteCards } from "../../../modules/inventory/service";

export async function onDeleteCards(input: { ids: number[] }) {
  assertAdminAccess();
  return deleteCards(input);
}
