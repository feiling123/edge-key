import { getContext } from "telefunc";
import type { PrismaClient } from "../../generated/prisma/client";
import { badRequestError, conflictError } from "../../lib/app-error";
import { listPaymentConfigRecords, listPaymentConfigSummaries, getPaymentConfigRecord } from "./repository";
import type { PaymentConfigValue, PaymentMethodItem, PaymentProvider } from "./types";

export const defaultPaymentConfigs: Record<PaymentProvider, PaymentConfigValue> = {
  BEPUSDT: {
    provider: "BEPUSDT",
    name: "BEpusdt",
    isEnabled: false,
    baseUrl: "",
    appId: "",
    appSecret: "",
    merchantId: "default",
    paymentType: "USDT-TRC20",
    paymentTypes: ["USDT-TRC20"],
    notifyUrl: "/api/payments/bepusdt/notify",
    returnUrl: "/order/{orderNo}?token={token}",
  },
  EPAY: {
    provider: "EPAY",
    name: "聚合支付",
    isEnabled: false,
    baseUrl: "",
    pid: "",
    key: "",
    notifyUrl: "/api/payments/epay/notify",
    returnUrl: "/order/{orderNo}?token={token}",
  },
  ALIPAY: {
    provider: "ALIPAY",
    name: "支付宝",
    isEnabled: false,
    baseUrl: "https://openapi.alipay.com",
    alipayAppId: "",
    alipayPrivateKey: "",
    alipayPublicKey: "",
    notifyUrl: "/api/payments/alipay/notify",
    returnUrl: "/order/{orderNo}?token={token}",
  },
  STRIPE: {
    provider: "STRIPE",
    name: "Stripe",
    isEnabled: false,
    baseUrl: "https://api.stripe.com",
    stripeSecretKey: "",
    stripeWebhookSecret: "",
    stripeCurrency: "cny",
    notifyUrl: "/api/payments/stripe/notify",
    returnUrl: "/order/{orderNo}?token={token}",
  },
};

export const paymentProviders = Object.keys(defaultPaymentConfigs) as PaymentProvider[];

export const MAX_PAYMENT_CONFIG_JSON_LENGTH = 64_000;
const MAX_PAYMENT_CONFIG_NAME_LENGTH = 128;
const MAX_PAYMENT_CONFIG_URL_LENGTH = 2_048;
const MAX_PAYMENT_CONFIG_SECRET_LENGTH = 16_384;
const MAX_PAYMENT_TYPES = 20;
const MAX_PAYMENT_TYPE_LENGTH = 64;

function getPaymentContext() {
  return getContext<{ prisma: PrismaClient }>();
}

type PaymentConfigRecordForNormalize = Awaited<ReturnType<typeof getPaymentConfigRecord>>;
type PaymentConfigSummaryRecord = Awaited<ReturnType<typeof listPaymentConfigSummaries>>[number];
export type AdminPaymentConfigSummary = Pick<PaymentConfigValue, "provider" | "name" | "isEnabled">;

function cloneDefaultPaymentConfig(provider: PaymentProvider): PaymentConfigValue {
  const defaults = defaultPaymentConfigs[provider];
  return {
    ...defaults,
    paymentTypes: defaults.paymentTypes ? [...defaults.paymentTypes] : undefined,
  };
}

function limitString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function isPaymentProvider(value: unknown): value is PaymentProvider {
  return typeof value === "string" && (paymentProviders as readonly string[]).includes(value);
}

export function assertPaymentProvider(value: unknown): PaymentProvider {
  if (!isPaymentProvider(value)) {
    throw badRequestError("支付方式不存在", "PAYMENT_PROVIDER_INVALID");
  }
  return value;
}

function toAdminPaymentSummary(record: PaymentConfigSummaryRecord | null, provider: PaymentProvider): AdminPaymentConfigSummary {
  const defaults = defaultPaymentConfigs[provider];
  return {
    provider,
    name: limitString(record?.name, MAX_PAYMENT_CONFIG_NAME_LENGTH) || defaults.name,
    isEnabled: record?.isEnabled === true,
  };
}

export function normalizeBepusdtPaymentTypes(input: Pick<PaymentConfigValue, "paymentType" | "paymentTypes">): string[] {
  return Array.from(
    new Set(
      [...(Array.isArray(input.paymentTypes) ? input.paymentTypes : []), input.paymentType ?? ""]
        .map((item) => String(item).trim().slice(0, MAX_PAYMENT_TYPE_LENGTH))
        .filter(Boolean),
    ),
  ).slice(0, MAX_PAYMENT_TYPES);
}

export function sanitizePaymentConfig(input: PaymentConfigValue, provider: PaymentProvider): PaymentConfigValue {
  const defaults = cloneDefaultPaymentConfig(provider);
  const value: PaymentConfigValue = {
    ...input,
    provider,
    name: limitString(input.name, MAX_PAYMENT_CONFIG_NAME_LENGTH) || defaults.name,
    isEnabled: input.isEnabled === true,
    baseUrl: limitString(input.baseUrl, MAX_PAYMENT_CONFIG_URL_LENGTH),
    appId: limitString(input.appId, MAX_PAYMENT_CONFIG_SECRET_LENGTH),
    appSecret: limitString(input.appSecret, MAX_PAYMENT_CONFIG_SECRET_LENGTH),
    merchantId: limitString(input.merchantId, MAX_PAYMENT_CONFIG_NAME_LENGTH) || defaults.merchantId,
    paymentType: limitString(input.paymentType, MAX_PAYMENT_TYPE_LENGTH),
    pid: limitString(input.pid, MAX_PAYMENT_CONFIG_SECRET_LENGTH),
    key: limitString(input.key, MAX_PAYMENT_CONFIG_SECRET_LENGTH),
    notifyUrl: limitString(input.notifyUrl, MAX_PAYMENT_CONFIG_URL_LENGTH),
    returnUrl: limitString(input.returnUrl, MAX_PAYMENT_CONFIG_URL_LENGTH),
    alipayAppId: limitString(input.alipayAppId, MAX_PAYMENT_CONFIG_SECRET_LENGTH),
    alipayPrivateKey: limitString(input.alipayPrivateKey, MAX_PAYMENT_CONFIG_SECRET_LENGTH),
    alipayPublicKey: limitString(input.alipayPublicKey, MAX_PAYMENT_CONFIG_SECRET_LENGTH),
    stripeSecretKey: limitString(input.stripeSecretKey, MAX_PAYMENT_CONFIG_SECRET_LENGTH),
    stripeWebhookSecret: limitString(input.stripeWebhookSecret, MAX_PAYMENT_CONFIG_SECRET_LENGTH),
    stripeCurrency: limitString(input.stripeCurrency, 16) || defaults.stripeCurrency,
  };

  if (provider === "BEPUSDT") {
    const paymentTypes = normalizeBepusdtPaymentTypes(input);
    value.paymentTypes = paymentTypes.length ? paymentTypes : defaults.paymentTypes;
    value.paymentType = value.paymentTypes?.[0] ?? defaults.paymentType;
  } else {
    value.paymentTypes = [];
  }

  return value;
}

export function normalizePaymentConfig(record: PaymentConfigRecordForNormalize, provider: PaymentProvider): PaymentConfigValue {
  const defaults = cloneDefaultPaymentConfig(provider);
  if (!record) {
    return defaults;
  }

  if (record.configJson.length > MAX_PAYMENT_CONFIG_JSON_LENGTH) {
    console.warn("payment.config_oversized", {
      provider,
      size: record.configJson.length,
      limit: MAX_PAYMENT_CONFIG_JSON_LENGTH,
    });
    return {
      ...defaults,
      provider,
      name: limitString(record.name, MAX_PAYMENT_CONFIG_NAME_LENGTH) || defaults.name,
      isEnabled: false,
    };
  }

  try {
    const parsed = JSON.parse(record.configJson) as Partial<PaymentConfigValue>;
    return sanitizePaymentConfig({
      ...defaults,
      ...parsed,
      provider,
      name: record.name,
      isEnabled: record.isEnabled,
    }, provider);
  } catch {
    return {
      ...defaults,
      provider,
      name: limitString(record.name, MAX_PAYMENT_CONFIG_NAME_LENGTH) || defaults.name,
      isEnabled: false,
    };
  }
}

function stripAdminSecretFields(input: Partial<PaymentConfigValue>): Partial<PaymentConfigValue> {
  return {
    ...input,
    appSecret: "",
    key: "",
    alipayPrivateKey: "",
    alipayPublicKey: "",
    stripeSecretKey: "",
    stripeWebhookSecret: "",
  };
}

export function normalizeAdminPaymentConfig(record: PaymentConfigRecordForNormalize, provider: PaymentProvider): PaymentConfigValue {
  const defaults = cloneDefaultPaymentConfig(provider);
  if (!record) {
    return redactAdminPaymentConfig(defaults);
  }

  if (record.configJson.length > MAX_PAYMENT_CONFIG_JSON_LENGTH) {
    console.warn("payment.admin_config_oversized", {
      provider,
      size: record.configJson.length,
      limit: MAX_PAYMENT_CONFIG_JSON_LENGTH,
    });
    return redactAdminPaymentConfig({
      ...defaults,
      provider,
      name: limitString(record.name, MAX_PAYMENT_CONFIG_NAME_LENGTH) || defaults.name,
      isEnabled: false,
    });
  }

  try {
    const parsed = stripAdminSecretFields(JSON.parse(record.configJson) as Partial<PaymentConfigValue>);
    return sanitizePaymentConfig({
      ...defaults,
      ...parsed,
      provider,
      name: record.name,
      isEnabled: record.isEnabled,
    }, provider);
  } catch {
    return redactAdminPaymentConfig({
      ...defaults,
      provider,
      name: limitString(record.name, MAX_PAYMENT_CONFIG_NAME_LENGTH) || defaults.name,
      isEnabled: false,
    });
  }
}

export async function listEnabledPaymentMethods(prisma?: PrismaClient): Promise<PaymentMethodItem[]> {
  const client = prisma ?? getPaymentContext().prisma;
  const records = await listPaymentConfigRecords(client, paymentProviders);
  const recordsByProvider = new Map(records.map((record) => [record.provider, record]));

  const methods: PaymentMethodItem[] = [];
  for (const provider of paymentProviders) {
    const record = recordsByProvider.get(provider);
    const value = normalizePaymentConfig(record ?? null, provider);

    if (provider === "BEPUSDT") {
      const paymentTypes = normalizeBepusdtPaymentTypes(value);
      for (const paymentType of paymentTypes.length ? paymentTypes : ["USDT-TRC20"]) {
        methods.push({
          provider,
          label: paymentType,
          enabled: value.isEnabled,
          baseUrl: value.baseUrl,
          paymentChannel: paymentType,
        });
      }
      continue;
    }

    methods.push({
      provider,
      label: value.name,
      enabled: value.isEnabled,
      baseUrl: value.baseUrl,
    });
  }

  return methods;
}

export async function getPaymentConfigs(prisma?: PrismaClient): Promise<Record<string, PaymentConfigValue>> {
  const client = prisma ?? getPaymentContext().prisma;
  const records = await listPaymentConfigRecords(client, paymentProviders);
  const recordsByProvider = new Map(records.map((record) => [record.provider, record]));
  const result: Record<string, PaymentConfigValue> = {};
  for (const provider of paymentProviders) {
    const record = recordsByProvider.get(provider) ?? null;
    result[provider] = normalizePaymentConfig(record, provider);
  }
  return result;
}

export async function getPaymentConfig(providerInput: PaymentProvider | string, prisma?: PrismaClient): Promise<PaymentConfigValue> {
  const provider = assertPaymentProvider(providerInput);
  const client = prisma ?? getPaymentContext().prisma;
  const record = await getPaymentConfigRecord(client, provider);
  return normalizePaymentConfig(record, provider);
}

export function redactAdminPaymentConfig(config: PaymentConfigValue): PaymentConfigValue {
  return {
    ...config,
    appSecret: "",
    key: "",
    alipayPrivateKey: "",
    alipayPublicKey: "",
    stripeSecretKey: "",
    stripeWebhookSecret: "",
  };
}

export async function getAdminPaymentSummaries(prisma?: PrismaClient): Promise<Record<string, AdminPaymentConfigSummary>> {
  const client = prisma ?? getPaymentContext().prisma;
  const records = await listPaymentConfigSummaries(client, paymentProviders);
  const recordsByProvider = new Map(records.map((record) => [record.provider, record]));
  return Object.fromEntries(
    paymentProviders.map((provider) => [provider, toAdminPaymentSummary(recordsByProvider.get(provider) ?? null, provider)]),
  );
}

export async function getAdminPaymentConfig(providerInput: PaymentProvider | string, prisma?: PrismaClient): Promise<PaymentConfigValue> {
  const provider = assertPaymentProvider(providerInput);
  const client = prisma ?? getPaymentContext().prisma;
  const record = await getPaymentConfigRecord(client, provider);
  return normalizeAdminPaymentConfig(record, provider);
}

export async function getAdminPaymentConfigs(prisma?: PrismaClient): Promise<Record<string, PaymentConfigValue>> {
  const client = prisma ?? getPaymentContext().prisma;
  const records = await listPaymentConfigRecords(client, paymentProviders);
  const recordsByProvider = new Map(records.map((record) => [record.provider, record]));
  return Object.fromEntries(
    paymentProviders.map((provider) => [provider, normalizeAdminPaymentConfig(recordsByProvider.get(provider) ?? null, provider)]),
  );
}

export async function validatePaymentSelection(
  input: { provider: PaymentProvider; paymentChannel?: string },
  prisma?: PrismaClient,
): Promise<string | null> {
  const client = prisma ?? getPaymentContext().prisma;
  const provider = assertPaymentProvider(input.provider);
  const config = await getPaymentConfig(provider, client);

  if (!config?.isEnabled) {
    throw conflictError(`${config?.name ?? provider} 当前未启用`, "PAYMENT_PROVIDER_DISABLED");
  }

  if (!config.baseUrl) {
    throw badRequestError(`${config.name} 缺少网关地址配置`, "PAYMENT_PROVIDER_BASE_URL_MISSING");
  }

  if (provider === "BEPUSDT") {
    const paymentTypes = normalizeBepusdtPaymentTypes(config);
    const selectedType = input.paymentChannel?.trim() || "";
    if (!selectedType) {
      throw badRequestError("请选择 BEpusdt 支付币种", "BEPUSDT_PAYMENT_TYPE_REQUIRED");
    }
    if (!paymentTypes.includes(selectedType)) {
      throw badRequestError("BEpusdt 未启用该支付币种", "BEPUSDT_PAYMENT_TYPE_DISABLED");
    }
    return selectedType;
  }

  if (provider === "EPAY") {
    return input.paymentChannel === "wxpay" ? "wxpay" : "alipay";
  }

  if (provider === "ALIPAY") {
    return input.paymentChannel?.trim() || "alipay_h5";
  }

  return input.paymentChannel?.trim() || null;
}
