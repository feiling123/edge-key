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
}) {
  assertAdminAccess();
  return saveSiteSetting(input);
}
