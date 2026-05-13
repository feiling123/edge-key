import type { PageContextServer } from "vike/types";
import { adminPublicPath } from "../lib/admin-path";

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
  const isAdminRoute = pageContext.urlPathname?.startsWith("/admin") ?? false;
  const site = isAdminRoute
    ? { ...defaultSiteShell }
    : await (await import("../modules/site/service")).getPublicSiteInfo(pageContext.prisma);

  return {
    pageContext: {
      site,
      adminBase: adminPublicPath(process.env),
      title: site?.siteName || "EdgeKey Store",
      description: site?.siteSubtitle || "Cloudflare Workers digital delivery store",
    },
  };
}
