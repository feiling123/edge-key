import { validatePaymentConfigInput } from "../../lib/validators/payment";
import { badRequestError } from "../../lib/app-error";
import { getAdminContext, logAdminOperation } from "../auth/service";
import {
  assertPaymentProvider,
  defaultPaymentConfigs,
  MAX_PAYMENT_CONFIG_JSON_LENGTH,
  normalizeAdminPaymentConfig,
  normalizeBepusdtPaymentTypes,
  normalizePaymentConfig,
} from "./config";
import { getPaymentConfigRecord, upsertPaymentConfigRecord } from "./repository";
import type { PaymentConfigValue } from "./types";

export async function savePaymentConfig(input: PaymentConfigValue) {
  const adminContext = getAdminContext();
  const { prisma } = adminContext;
  const adminId = Number(adminContext.session?.user?.id);
  const provider = assertPaymentProvider(input.provider);

  const existingRecord = await getPaymentConfigRecord(prisma, provider);
  const existingConfig = normalizePaymentConfig(existingRecord, provider);
  const mergedInput: PaymentConfigValue = {
    ...input,
    provider,
    appSecret: input.appSecret?.trim() || existingConfig.appSecret || "",
    key: input.key?.trim() || existingConfig.key || "",
    alipayPrivateKey: input.alipayPrivateKey?.trim() || existingConfig.alipayPrivateKey || "",
    alipayPublicKey: input.alipayPublicKey?.trim() || existingConfig.alipayPublicKey || "",
    stripeSecretKey: input.stripeSecretKey?.trim() || existingConfig.stripeSecretKey || "",
    stripeWebhookSecret: input.stripeWebhookSecret?.trim() || existingConfig.stripeWebhookSecret || "",
  };

  validatePaymentConfigInput(mergedInput as any);
  const baseConfig = {
    baseUrl: mergedInput.baseUrl?.trim() || "",
    notifyUrl: mergedInput.notifyUrl?.trim() || "",
    returnUrl: mergedInput.returnUrl?.trim() || "",
  };
  const bepusdtPaymentTypes = provider === "BEPUSDT" ? normalizeBepusdtPaymentTypes(mergedInput) : [];
  const config =
    provider === "BEPUSDT"
      ? {
          ...baseConfig,
          appId: mergedInput.appId?.trim() || "",
          appSecret: mergedInput.appSecret?.trim() || "",
          merchantId: mergedInput.merchantId?.trim() || "default",
          paymentType: bepusdtPaymentTypes[0] ?? "",
          paymentTypes: bepusdtPaymentTypes,
        }
      : provider === "EPAY"
        ? {
            ...baseConfig,
            pid: mergedInput.pid?.trim() || "",
            key: mergedInput.key?.trim() || "",
          }
        : provider === "ALIPAY"
          ? {
              ...baseConfig,
              alipayAppId: mergedInput.alipayAppId?.trim() || "",
              alipayPrivateKey: mergedInput.alipayPrivateKey?.trim() || "",
              alipayPublicKey: mergedInput.alipayPublicKey?.trim() || "",
            }
          : {
              ...baseConfig,
              stripeSecretKey: mergedInput.stripeSecretKey?.trim() || "",
              stripeWebhookSecret: mergedInput.stripeWebhookSecret?.trim() || "",
              stripeCurrency: mergedInput.stripeCurrency?.trim() || "cny",
            };
  const configJson = JSON.stringify(config);

  if (configJson.length > MAX_PAYMENT_CONFIG_JSON_LENGTH) {
    throw badRequestError("支付配置过大，请精简密钥或配置内容", "PAYMENT_CONFIG_TOO_LARGE");
  }

  const record = await upsertPaymentConfigRecord(prisma, provider, {
    name: mergedInput.name.trim() || defaultPaymentConfigs[provider].name,
    isEnabled: mergedInput.isEnabled,
    configJson,
  });

  await logAdminOperation(
    {
      action: "SAVE_PAYMENT_CONFIG",
      targetType: "PaymentConfig",
      targetId: provider,
      detail: `enabled=${mergedInput.isEnabled}`,
    },
    {
      prisma,
      adminId,
    },
  );

  return normalizeAdminPaymentConfig(record, provider);
}
