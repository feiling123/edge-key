import type { PrismaClient } from "../../generated/prisma/client";

/**
 * 创建种子数据
 */
export async function createSeedData(prisma: PrismaClient) {
  try {
    // 检查是否已有管理员账号
    const existingAdmin = await prisma.admin.findFirst();
    if (!existingAdmin) {
      // 创建默认管理员账号 - 密码：admin123
      // 这个哈希值对应密码 "admin123"
      const defaultPasswordHash = "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi";
      
      await prisma.admin.create({
        data: {
          username: "admin",
          passwordHash: defaultPasswordHash,
          nickname: "管理员",
          status: "ACTIVE",
        },
      });
    }

    // 检查是否已有站点设置
    const existingSite = await prisma.siteSetting.findFirst();
    if (!existingSite) {
      await prisma.siteSetting.create({
        data: {
          id: 1,
          siteName: "EK发卡商城",
          siteSubtitle: "自动发货数字商品商城",
          notice: "欢迎来到我们的数字商品商城！支付后自动发货。",
          orderNotice: "下单后请及时支付，支付成功后系统将自动发货到您的邮箱。",
          enableTurnstile: false,
          enableOrderToken: false,
          orderTokenExpiryMin: 5,
        },
      });
    }

    return true;
  } catch (error) {
    console.error("Failed to create seed data:", error);
    return false;
  }
}