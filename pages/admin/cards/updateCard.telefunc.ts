import { assertAdminAccess } from "../../../modules/auth/service";
import { updateCard } from "../../../modules/inventory/service";

export async function onUpdateCard(input: { id: number; productId: number; content: string; batchNo?: string }) {
  assertAdminAccess();
  return updateCard(input);
}
