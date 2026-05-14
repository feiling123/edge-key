import { getContext } from "telefunc";
import type { PrismaClient } from "../../generated/prisma/client";
import { validateSiteSettingsInput } from "../../lib/validators/site";
import { getAdminContext, logAdminOperation } from "../auth/service";
import { getSiteSettingRecord, upsertSiteSettingRecord } from "./repository";
import type { SiteSettingInput } from "./types";

const defaultSiteSetting = {
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
  // 安全功能默认配置
  enableTurnstile: false,
  turnstileSiteKey: null,
  turnstileSecretKey: null,
  enableOrderToken: false,
  orderTokenExpiryMin: 5,
};

const defaultPublicSiteSetting = {
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
  // 公开安全功能配置（不包含 Secret Key）
  enableTurnstile: false,
  turnstileSiteKey: null,
  // turnstileSecretKey 故意省略
  enableOrderToken: false,
  orderTokenExpiryMin: 5,
};

function normalizeSetting(record: Awaited<ReturnType<typeof getSiteSettingRecord>>) {
  if (!record) {
    return defaultSiteSetting;
  }

  return {
    siteName: record.siteName,
    siteUrl: record.siteUrl ?? "",
    siteSubtitle: record.siteSubtitle,
    logoIcon: record.logoIcon ?? "",
    logo: record.logo ?? "",
    notice: record.notice,
    noticePageZh: record.noticePageZh ?? "",
    noticePageEn: record.noticePageEn ?? "",
    aboutPageZh: record.aboutPageZh ?? "",
    aboutPageEn: record.aboutPageEn ?? "",
    supportContact: record.supportContact,
    footerText: record.footerText,
    orderNotice: record.orderNotice,
    // 安全功能配置（向后兼容）
    enableTurnstile: record.enableTurnstile ?? false,
    turnstileSiteKey: record.turnstileSiteKey ?? "",
    turnstileSecretKey: record.turnstileSecretKey ?? "",
    enableOrderToken: record.enableOrderToken ?? false,
    orderTokenExpiryMin: record.orderTokenExpiryMin ?? 5,
  };
}

/**
 * 获取公开的站点信息（不包含敏感数据）
 */
function normalizePublicSetting(record: Awaited<ReturnType<typeof getSiteSettingRecord>>) {
  if (!record) {
    return defaultPublicSiteSetting;
  }

  return {
    siteName: record.siteName,
    siteUrl: record.siteUrl ?? "",
    siteSubtitle: record.siteSubtitle,
    logoIcon: record.logoIcon ?? "",
    logo: record.logo ?? "",
    notice: record.notice,
    noticePageZh: record.noticePageZh ?? "",
    noticePageEn: record.noticePageEn ?? "",
    aboutPageZh: record.aboutPageZh ?? "",
    aboutPageEn: record.aboutPageEn ?? "",
    supportContact: record.supportContact,
    footerText: record.footerText,
    orderNotice: record.orderNotice,
    // 公开的安全功能配置（不包含 Secret Key）
    enableTurnstile: record.enableTurnstile ?? false,
    turnstileSiteKey: record.turnstileSiteKey ?? "", // 前端需要用这个
    // turnstileSecretKey 故意省略，不暴露给前端
    enableOrderToken: record.enableOrderToken ?? false,
    orderTokenExpiryMin: record.orderTokenExpiryMin ?? 5,
  };
}

export function getDefaultSiteShell() {
  return {
    ...defaultSiteSetting,
  };
}

export async function getPublicSiteInfo(prisma?: PrismaClient) {
  const client = prisma ?? getContext<{ prisma: PrismaClient }>().prisma;
  const record = await getSiteSettingRecord(client);
  return normalizePublicSetting(record);
}

export async function getSiteSetting(prisma?: PrismaClient) {
  return getPublicSiteInfo(prisma);
}

/**
 * 获取完整的站点设置（包含敏感数据）
 * 仅供服务端内部使用，不要传递给前端
 */
export async function getFullSiteSetting(prisma?: PrismaClient) {
  const client = prisma ?? getContext<{ prisma: PrismaClient }>().prisma;
  const record = await getSiteSettingRecord(client);
  return normalizeSetting(record);
}

export async function saveSiteSetting(input: SiteSettingInput) {
  const adminContext = getAdminContext();
  const { prisma } = adminContext;
  const adminId = Number(adminContext.session?.user?.id);
  const { siteName, siteUrl } = validateSiteSettingsInput(input);

  const record = await upsertSiteSettingRecord(prisma, {
    siteName,
    siteUrl,
    siteSubtitle: input.siteSubtitle?.trim() || null,
    logoIcon: input.logoIcon?.trim() || null,
    logo: input.logo?.trim() || null,
    notice: input.notice?.trim() || null,
    noticePageZh: input.noticePageZh?.trim() || null,
    noticePageEn: input.noticePageEn?.trim() || null,
    aboutPageZh: input.aboutPageZh?.trim() || null,
    aboutPageEn: input.aboutPageEn?.trim() || null,
    supportContact: input.supportContact?.trim() || null,
    footerText: input.footerText?.trim() || null,
    orderNotice: input.orderNotice?.trim() || null,
    // 安全功能配置
    enableTurnstile: input.enableTurnstile ?? false,
    turnstileSiteKey: input.turnstileSiteKey?.trim() || null,
    turnstileSecretKey: input.turnstileSecretKey?.trim() || null,
    enableOrderToken: input.enableOrderToken ?? false,
    orderTokenExpiryMin: Math.max(1, Math.min(60, Math.floor(input.orderTokenExpiryMin ?? 5))),
  });

  await logAdminOperation(
    {
      action: "SAVE_SITE_SETTING",
      targetType: "SiteSetting",
      targetId: "1",
      detail: `siteName=${siteName}`,
    },
    {
      prisma,
      adminId,
    },
  );

  return normalizeSetting(record);
}
