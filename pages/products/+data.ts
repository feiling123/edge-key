import { getHomeCatalog } from "../../modules/catalog/service";
import { getPublicSiteInfo } from "../../modules/site/service";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: {
  prisma: import("../../generated/prisma/client").PrismaClient;
}) {
  return {
    site: await getPublicSiteInfo(pageContext.prisma),
    catalog: await getHomeCatalog(pageContext.prisma, { productLimit: null }),
  };
}
