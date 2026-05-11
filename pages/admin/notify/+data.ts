import { getTelegramManagementData } from "../../../modules/notify/service";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: {
  prisma: import("../../../generated/prisma/client").PrismaClient;
  session?: { user?: { role?: string } };
}) {
  if (pageContext.session?.user?.role !== "admin") {
    return {
      configs: [],
      templates: [],
      logs: [],
      metrics: [],
      pushSettings: {
        notifyOrderPaid: false,
        notifyDeliverySuccess: false,
        notifyDeliveryFailed: false,
        notifyOrderDeleted: false,
        notifyAdminLogin: false,
      },
    };
  }

  return getTelegramManagementData(pageContext.prisma);
}
