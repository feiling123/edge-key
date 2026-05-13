import { assertAdminAccess } from "../../../modules/auth/service";
import { getAdminPaymentConfig } from "../../../modules/payment/config";
import type { PaymentProvider } from "../../../modules/payment/types";

export async function onLoadPaymentConfig(input: { provider: PaymentProvider }) {
  assertAdminAccess();
  return getAdminPaymentConfig(input.provider);
}
