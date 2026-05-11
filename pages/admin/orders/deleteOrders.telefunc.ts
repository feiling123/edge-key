import { assertAdminAccess } from "../../../modules/auth/service";
import { deleteOrders } from "../../../modules/order/service";

export async function onDeleteOrders(input: { ids: number[] }) {
  assertAdminAccess();
  return deleteOrders(input);
}
