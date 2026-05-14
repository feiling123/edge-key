import type { PageContextServer } from "vike/types";
import { adminPublicPath } from "../lib/admin-path";
import { autoMigrateDatabase } from "../lib/utils/auto-migrate";

const defaultSiteShell = {
  siteName: "",
  siteUrl: "",
  siteSubtitle: "",
  logoIcon: "",
  logo: "",
  notice: "",
  noticePageZh: "",
  noticePageEn: "",
  aboutPageZh: "",
  aboutPageEn: "",
  supportContact: null,
  footerText: null,
  orderNotice: null,
};

export async function onBeforeRender(pageContext: PageContextServer) {
  // 自动初始化数据库（仅在第一次访问时）
  try {
    await autoMigrateDatabase(pageContext.prisma);
  } catch (error) {
    console.warn("Auto-migration failed, continuing with default site shell", error);
  }

  const isAdminRoute = pageContext.urlPathname?.startsWith("/admin") ?? false;
  let site;
  
  try {
    site = isAdminRoute
      ? { ...defaultSiteShell }
      : await (await import("../modules/site/service")).getPublicSiteInfo(pageContext.prisma);
  } catch (error) {
    // 如果数据库还未完全初始化，使用默认值
    console.warn("Failed to get site info, using defaults", error);
    site = { ...defaultSiteShell };
  }

  return {
    pageContext: {
      site,
      adminBase: adminPublicPath(process.env),
      title: site?.siteName || "EdgeKey Store",
      description: site?.siteSubtitle || "Cloudflare Workers digital delivery store",
    },
  };
}
