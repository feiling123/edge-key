import { logger } from "../lib/logger";
import migration0001 from "../prisma/migrations/0001_init.sql?raw";
import migration0002 from "../prisma/migrations/0002_runtime_secret.sql?raw";
import migration0003 from "../prisma/migrations/0003_site_content_pages.sql?raw";
import migration0004 from "../prisma/migrations/0004_delivery_idempotency.sql?raw";
import migration0005 from "../prisma/migrations/0005_delivery_locks_and_telegram_audit.sql?raw";

const bootstrappedDatabases = new WeakSet<D1Database>();
const migrationTable = "__edgekey_runtime_migrations";

const migrations = [
  { id: "0001_init", sql: toIdempotentSql(migration0001) },
  { id: "0002_runtime_secret", sql: toIdempotentSql(migration0002) },
  { id: "0003_site_content_pages", sql: toIdempotentSql(migration0003) },
  { id: "0004_delivery_idempotency", sql: toIdempotentSql(migration0004) },
  { id: "0005_delivery_locks_and_telegram_audit", sql: toIdempotentSql(migration0005) },
];

export async function ensureD1Ready(database: D1Database) {
  if (bootstrappedDatabases.has(database)) return;
  await bootstrapD1(database);
  bootstrappedDatabases.add(database);
}

async function bootstrapD1(database: D1Database) {
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS "${migrationTable}" ("id" TEXT NOT NULL PRIMARY KEY, "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    )
    .run();

  const appliedRows = await database
    .prepare(`SELECT "id" FROM "${migrationTable}"`)
    .all<{ id: string }>();
  const applied = new Set((appliedRows.results ?? []).map((row) => row.id));

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;

    await executeSqlScript(database, migration.sql);
    await database
      .prepare(`INSERT OR REPLACE INTO "${migrationTable}" ("id", "appliedAt") VALUES (?, CURRENT_TIMESTAMP)`)
      .bind(migration.id)
      .run();
  }

  await seedD1(database);

  logger.info("d1.bootstrap.completed");
}

function toIdempotentSql(sql: string) {
  return sql
    .replace(/CREATE UNIQUE INDEX\s+"/g, 'CREATE UNIQUE INDEX IF NOT EXISTS "')
    .replace(/CREATE INDEX\s+"/g, 'CREATE INDEX IF NOT EXISTS "')
    .replace(/CREATE TABLE\s+"/g, 'CREATE TABLE IF NOT EXISTS "');
}

async function executeSqlScript(database: D1Database, sql: string) {
  for (const statement of splitSqlStatements(sql)) {
    try {
      await database.prepare(normalizeSql(statement)).run();
    } catch (error) {
      if (isIgnorableMigrationError(error)) {
        logger.info("d1.bootstrap.ignored_migration_statement", {
          message: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
      throw error;
    }
  }
}

function isIgnorableMigrationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate column name|already exists/i.test(message);
}

function splitSqlStatements(sql: string) {
  const statements: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index] ?? "";
    const next = sql[index + 1] ?? "";

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
        current += " ";
      }
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (!quote && char === "-" && next === "-") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (!quote && char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (quote) {
      current += char;
      if (char === quote) {
        if (quote === "'" && next === "'") {
          current += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }

    if (char === ";") {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
      continue;
    }

    current += char;
  }

  const finalStatement = current.trim();
  if (finalStatement) statements.push(finalStatement);

  return statements;
}

function normalizeSql(sql: string) {
  let normalized = "";
  let quote: "'" | '"' | null = null;
  let lastWasSpace = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index] ?? "";
    const next = sql[index + 1] ?? "";

    if (quote) {
      normalized += char;
      if (char === quote) {
        if (quote === "'" && next === "'") {
          normalized += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      normalized += char;
      lastWasSpace = false;
      continue;
    }

    if (/\s/.test(char)) {
      if (!lastWasSpace) {
        normalized += " ";
        lastWasSpace = true;
      }
      continue;
    }

    normalized += char;
    lastWasSpace = false;
  }

  return normalized.trim();
}

async function seedD1(database: D1Database) {
  await database
    .prepare(
      `INSERT INTO "Admin" ("username", "passwordHash", "nickname", "status", "updatedAt") VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT("username") DO NOTHING`,
    )
    .bind("admin", "$2b$10$viMe8RgcpM30gmmF9OpOcuA/QgleSIUk5VRtqjOulfSIbgK5jQCI6", "管理员", "ACTIVE")
    .run();

  await database
    .prepare(
      `INSERT INTO "SiteSetting" ("id", "siteName", "siteSubtitle", "notice", "noticePageZh", "noticePageEn", "aboutPageZh", "aboutPageEn", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT("id") DO NOTHING`,
    )
    .bind(
      1,
      "EK发卡商城",
      "Cloudflare Workers 免费部署自动发卡商城",
      "全球部署，一触即达。",
      "欢迎使用本站。购买前请确认商品说明、发货方式和售后规则。",
      "Welcome. Please review product details, delivery method, and support rules before purchasing.",
      "本站是一个基于 Cloudflare Workers 的自动发卡商城，支持数字商品展示、在线支付和自动发货。",
      "This storefront runs on Cloudflare Workers and supports digital product listing, online payment, and automated delivery.",
    )
    .run();

  const templates = [
    {
      scene: "TEST",
      name: "测试通知",
      content: `Telegram 测试通知

站点：{{siteName}}
发送时间：{{sentAt}}

{{customContent}}`,
    },
    {
      scene: "ORDER_PAID",
      name: "收款成功通知",
      content: `收款成功通知

订单号：{{orderNo}}
商品：{{productName}}
金额：{{amount}}
查询地址：{{queryUrl}}`,
    },
    {
      scene: "DELIVERY_SUCCESS",
      name: "发货成功通知",
      content: `发货成功通知

订单号：{{orderNo}}
商品：{{productName}}
数量：{{quantity}}
发货内容：
{{deliveryItems}}

查询地址：{{queryUrl}}`,
    },
    {
      scene: "DELIVERY_FAILED",
      name: "发货失败告警",
      content: `发货失败告警

订单号：{{orderNo}}
商品：{{productName}}
失败原因：{{errorMessage}}

查询地址：{{queryUrl}}`,
    },
    {
      scene: "ORDER_DELETED",
      name: "删除订单日志",
      content: `删除订单日志

网站：{{siteUrl}}
订单号：{{orderNo}}
客户端 IP：{{clientIp}}
操作时间：{{sentAt}}`,
    },
    {
      scene: "ADMIN_LOGIN",
      name: "后台登录日志",
      content: `后台登录日志

网站：{{siteUrl}}
用户名：{{username}}
客户端 IP：{{clientIp}}
登录时间：{{sentAt}}`,
    },
  ];

  for (const template of templates) {
    await database
      .prepare(
        `INSERT INTO "TelegramTemplate" ("scene", "name", "content", "isEnabled", "updatedAt") VALUES (?, ?, ?, true, CURRENT_TIMESTAMP) ON CONFLICT("scene") DO NOTHING`,
      )
      .bind(template.scene, template.name, template.content)
      .run();
  }
}
