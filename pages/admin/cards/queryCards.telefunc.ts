import { Abort } from "telefunc";
import { toTelefuncErrorPayload } from "../../../lib/app-error";
import { assertAdminAccess } from "../../../modules/auth/service";
import { getAdminCardsPaged } from "../../../modules/inventory/service";

export async function onQueryCards(params: {
  productId?: number;
  batchNo?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}) {
  try {
    assertAdminAccess();
    return await getAdminCardsPaged(params);
  } catch (error) {
    throw Abort(toTelefuncErrorPayload(error));
  }
}
