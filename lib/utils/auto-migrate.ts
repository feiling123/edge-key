import type { PrismaClient } from "../../generated/prisma/client";
import { createSeedData } from "./seed-data";

/**
 * 自动数据库初始化
 * 在应用启动时检查数据库是否存在，如果不存在则自动创建
 */
export async function autoMigrateDatabase(prisma: PrismaClient): Promise<boolean> {
  try {
    // 检查 SiteSetting 表是否存在并且有数据
    await prisma.siteSetting.findFirstOrThrow();
    return true; // 数据库已存在且有数据
  } catch (error) {
    try {
      // 尝试创建种子数据（表结构应该已存在）
      await createSeedData(prisma);
      console.log("Database initialized with seed data");
      return true;
    } catch (seedError) {
      console.warn("Auto-migration failed:", seedError);
      return false;
    }
  }
}
