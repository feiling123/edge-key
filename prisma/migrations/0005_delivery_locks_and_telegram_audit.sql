ALTER TABLE "Card" ADD COLUMN "deliveryLockToken" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryLockToken" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryLockedAt" DATETIME;
ALTER TABLE "TelegramConfig" ADD COLUMN "notifyOrderDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TelegramConfig" ADD COLUMN "notifyAdminLogin" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Card_deliveryLockToken_idx" ON "Card"("deliveryLockToken");
CREATE INDEX "Order_deliveryLockToken_idx" ON "Order"("deliveryLockToken");

INSERT INTO "TelegramTemplate" ("scene", "name", "content", "isEnabled", "updatedAt")
VALUES
  ('ORDER_DELETED', '删除订单日志', '删除订单日志

网站：{{siteUrl}}
订单号：{{orderNo}}
客户端 IP：{{clientIp}}
操作时间：{{sentAt}}', true, CURRENT_TIMESTAMP),
  ('ADMIN_LOGIN', '后台登录日志', '后台登录日志

网站：{{siteUrl}}
用户名：{{username}}
客户端 IP：{{clientIp}}
登录时间：{{sentAt}}', true, CURRENT_TIMESTAMP)
ON CONFLICT("scene") DO NOTHING;
