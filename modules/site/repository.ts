import type { PrismaClient } from "../../generated/prisma/client";

export function getSiteSettingRecord(prisma: PrismaClient) {
  return prisma.siteSetting.findUnique({
    where: { id: 1 },
  });
}

export function upsertSiteSettingRecord(
  prisma: PrismaClient,
  input: {
    siteName: string;
    siteUrl?: string | null;
    siteSubtitle?: string | null;
    logoIcon?: string | null;
    logo?: string | null;
    notice?: string | null;
    noticePageZh?: string | null;
    noticePageEn?: string | null;
    aboutPageZh?: string | null;
    aboutPageEn?: string | null;
    supportContact?: string | null;
    footerText?: string | null;
    orderNotice?: string | null;
    // 安全功能配置
    enableTurnstile?: boolean;
    turnstileSiteKey?: string | null;
    turnstileSecretKey?: string | null;
    enableOrderToken?: boolean;
    orderTokenExpiryMin?: number;
  },
) {
  return prisma.siteSetting.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      siteName: input.siteName,
      siteUrl: input.siteUrl ?? null,
      siteSubtitle: input.siteSubtitle ?? null,
      logoIcon: input.logoIcon ?? null,
      logo: input.logo ?? null,
      notice: input.notice ?? null,
      noticePageZh: input.noticePageZh ?? null,
      noticePageEn: input.noticePageEn ?? null,
      aboutPageZh: input.aboutPageZh ?? null,
      aboutPageEn: input.aboutPageEn ?? null,
      supportContact: input.supportContact ?? null,
      footerText: input.footerText ?? null,
      orderNotice: input.orderNotice ?? null,
      // 安全功能配置
      enableTurnstile: input.enableTurnstile ?? false,
      turnstileSiteKey: input.turnstileSiteKey ?? null,
      turnstileSecretKey: input.turnstileSecretKey ?? null,
      enableOrderToken: input.enableOrderToken ?? false,
      orderTokenExpiryMin: input.orderTokenExpiryMin ?? 5,
    },
    update: {
      siteName: input.siteName,
      siteUrl: input.siteUrl ?? null,
      siteSubtitle: input.siteSubtitle ?? null,
      logoIcon: input.logoIcon ?? null,
      logo: input.logo ?? null,
      notice: input.notice ?? null,
      noticePageZh: input.noticePageZh ?? null,
      noticePageEn: input.noticePageEn ?? null,
      aboutPageZh: input.aboutPageZh ?? null,
      aboutPageEn: input.aboutPageEn ?? null,
      supportContact: input.supportContact ?? null,
      footerText: input.footerText ?? null,
      orderNotice: input.orderNotice ?? null,
      // 安全功能配置
      enableTurnstile: input.enableTurnstile ?? false,
      turnstileSiteKey: input.turnstileSiteKey ?? null,
      turnstileSecretKey: input.turnstileSecretKey ?? null,
      enableOrderToken: input.enableOrderToken ?? false,
      orderTokenExpiryMin: input.orderTokenExpiryMin ?? 5,
    },
  });
}
