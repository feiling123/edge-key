-- 添加安全功能配置字段
ALTER TABLE SiteSetting ADD COLUMN enableTurnstile INTEGER DEFAULT 0;
ALTER TABLE SiteSetting ADD COLUMN turnstileSiteKey TEXT;
ALTER TABLE SiteSetting ADD COLUMN turnstileSecretKey TEXT;
ALTER TABLE SiteSetting ADD COLUMN enableOrderToken INTEGER DEFAULT 0;
ALTER TABLE SiteSetting ADD COLUMN orderTokenExpiryMin INTEGER DEFAULT 5;