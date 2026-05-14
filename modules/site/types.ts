export interface SiteSettingInput {
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
}
