import type { PaymentProvider } from "../../../modules/payment/types";

export type Data = Awaited<ReturnType<typeof data>>;

const initialSummaries: Record<PaymentProvider, { provider: PaymentProvider; name: string; isEnabled: boolean }> = {
  BEPUSDT: { provider: "BEPUSDT", name: "BEpusdt", isEnabled: false },
  EPAY: { provider: "EPAY", name: "Epay", isEnabled: false },
  ALIPAY: { provider: "ALIPAY", name: "支付宝", isEnabled: false },
  STRIPE: { provider: "STRIPE", name: "Stripe", isEnabled: false },
};

export async function data() {
  return {
    summaries: initialSummaries,
  };
}
