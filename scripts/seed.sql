-- seed.sql
-- 此脚本由运行时 D1 初始化执行；手动全量部署时也可由 db:seed:remote 执行。
-- 所有语句均使用 ON CONFLICT DO NOTHING，即：记录不存在时插入初始数据，已存在时跳过。
-- 因此重复部署不会覆盖你在后台修改过的任何数据。

-- 管理员账号
INSERT INTO "Admin" ("username", "passwordHash", "nickname", "status", "updatedAt")
VALUES ('admin', '$2b$10$viMe8RgcpM30gmmF9OpOcuA/QgleSIUk5VRtqjOulfSIbgK5jQCI6', '管理员', 'ACTIVE', CURRENT_TIMESTAMP)
ON CONFLICT("username") DO NOTHING;

-- 站点设置
INSERT INTO "SiteSetting" ("id", "siteName", "siteSubtitle", "notice", "noticePageZh", "noticePageEn", "aboutPageZh", "aboutPageEn", "updatedAt")
VALUES (
  1,
  'EK发卡商城',
  'Cloudflare Workers 免费部署自动发卡商城',
  '全球部署，一触即达。',
  '欢迎使用本站。购买前请确认商品说明、发货方式和售后规则。',
  'Welcome. Please review product details, delivery method, and support rules before purchasing.',
  '本站是一个基于 Cloudflare Workers 的自动发卡商城，支持数字商品展示、在线支付和自动发货。',
  'This storefront runs on Cloudflare Workers and supports digital product listing, online payment, and automated delivery.',
  CURRENT_TIMESTAMP
)
ON CONFLICT("id") DO NOTHING;

-- Telegram 通知模板
INSERT INTO "TelegramTemplate" ("scene", "name", "content", "isEnabled", "updatedAt")
VALUES
  ('TEST', '测试通知', 'Telegram 测试通知
  
站点：{{siteName}}
发送时间：{{sentAt}}

{{customContent}}', true, CURRENT_TIMESTAMP),
  ('ORDER_PAID', '收款成功通知', '收款成功通知

订单号：{{orderNo}}
商品：{{productName}}
金额：{{amount}}
查询地址：{{queryUrl}}', true, CURRENT_TIMESTAMP),
  ('DELIVERY_SUCCESS', '发货成功通知', '发货成功通知

订单号：{{orderNo}}
商品：{{productName}}
数量：{{quantity}}
发货内容：
{{deliveryItems}}

查询地址：{{queryUrl}}', true, CURRENT_TIMESTAMP),
  ('DELIVERY_FAILED', '发货失败告警', '发货失败告警

订单号：{{orderNo}}
商品：{{productName}}
失败原因：{{errorMessage}}

查询地址：{{queryUrl}}', true, CURRENT_TIMESTAMP),
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
