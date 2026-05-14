import { assertAdminAccess } from "../../../modules/auth/service";
import { saveSiteSetting } from "../../../modules/site/service";

export async function onSaveSiteSettings(input: {
  siteName: string;
  siteUrl?: string;
  siteSubtitle?: string;
  logoIcon?: string;
  logo?: string;
  notice?: string;
  noticePageZh?: string;
  noticePageEn?: string;
  aboutPageZh?: string;
  aboutPageEn?: string;
  supportContact?: string;
  footerText?: string;
  orderNotice?: string;
  // 安全功能配置
  enableTurnstile?: boolean;
  turnstileSiteKey?: string;
  turnstileSecretKey?: string;
  enableOrderToken?: boolean;
  orderTokenExpiryMin?: number;
}) {
  assertAdminAccess();
  return saveSiteSetting(input);
}
