import { getOrderForQuery } from "../../../modules/order/service";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: {
  routeParams: { orderNo: string };
  urlParsed: { search: Record<string, string | undefined> };
  prisma: import("../../../generated/prisma/client").PrismaClient;
}) {
  const token = pageContext.urlParsed.search.token || "";
  return {
    order: await getOrderForQuery(pageContext.routeParams.orderNo, token, pageContext.urlParsed.search, pageContext.prisma, {
      waitForSyncMs: 3200,
      pollIntervalMs: 220,
      waitForDeliveryMs: 4200,
      deliveryPollIntervalMs: 220,
      deliveryRecoveryAfterMs: 500,
    }),
  };
}
