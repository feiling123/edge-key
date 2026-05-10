-- Add editable public content pages.
ALTER TABLE "SiteSetting" ADD COLUMN "noticePageZh" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "noticePageEn" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "aboutPageZh" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "aboutPageEn" TEXT;
