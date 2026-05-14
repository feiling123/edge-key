import { getProductBySlug } from "../../../modules/catalog/service";
import { listEnabledPaymentMethods } from "../../../modules/payment/service";
import { getSiteSetting } from "../../../modules/site/service";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: {
  routeParams: { slug: string };
  prisma: import("../../../generated/prisma/client").PrismaClient;
}) {
  const product = await getProductBySlug(pageContext.routeParams.slug, pageContext.prisma);

  return {
    product,
    paymentMethods: product ? (await listEnabledPaymentMethods(pageContext.prisma)).filter((item) => item.enabled) : [],
    siteSettings: await getSiteSetting(pageContext.prisma),
  };
}
