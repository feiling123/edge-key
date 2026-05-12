import { getOrderForEmailQuery, getOrderForQuery } from "../../modules/order/service";

export async function onQueryOrder(input: { orderNo: string; queryToken?: string; email?: string; waitForSync?: boolean }) {
  if (input.queryToken) {
    return getOrderForQuery(
      input.orderNo,
      input.queryToken,
      undefined,
      undefined,
      input.waitForSync
        ? {
            waitForSyncMs: 2400,
            pollIntervalMs: 220,
            waitForDeliveryMs: 3200,
            deliveryPollIntervalMs: 220,
            deliveryRecoveryAfterMs: 700,
          }
        : undefined,
    );
  }

  return getOrderForEmailQuery(input.orderNo, input.email ?? "");
}
