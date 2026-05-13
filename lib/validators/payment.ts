import { badRequestError } from "../app-error";

const MAX_NAME_LENGTH = 128;
const MAX_URL_LENGTH = 2_048;
const MAX_SECRET_LENGTH = 16_384;
const MAX_PAYMENT_TYPES = 20;
const MAX_PAYMENT_TYPE_LENGTH = 64;

function assertMaxLength(value: string | undefined, maxLength: number, message: string, code: string) {
  if ((value?.trim().length ?? 0) > maxLength) {
    throw badRequestError(message, code);
  }
}

export function validatePaymentConfigInput(input: {
  name?: string;
  baseUrl?: string;
  provider: string;
  isEnabled?: boolean;
  appSecret?: string;
  paymentType?: string;
  paymentTypes?: string[];
  pid?: string;
  key?: string;
  notifyUrl?: string;
  returnUrl?: string;
  alipayAppId?: string;
  alipayPrivateKey?: string;
  alipayPublicKey?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  stripeCurrency?: string;
}) {
  const name = input.name?.trim() || "";
  if (!name) {
    throw badRequestError("支付方式名称不能为空", "PAYMENT_NAME_REQUIRED");
  }
  assertMaxLength(input.name, MAX_NAME_LENGTH, "支付方式名称过长", "PAYMENT_NAME_TOO_LONG");
  assertMaxLength(input.baseUrl, MAX_URL_LENGTH, "网关地址过长", "PAYMENT_BASE_URL_TOO_LONG");
  assertMaxLength(input.appSecret, MAX_SECRET_LENGTH, "App Secret 过长", "PAYMENT_SECRET_TOO_LONG");
  assertMaxLength(input.pid, MAX_SECRET_LENGTH, "PID 过长", "PAYMENT_PID_TOO_LONG");
  assertMaxLength(input.key, MAX_SECRET_LENGTH, "Key 过长", "PAYMENT_KEY_TOO_LONG");
  assertMaxLength(input.notifyUrl, MAX_URL_LENGTH, "Notify URL 过长", "PAYMENT_NOTIFY_URL_TOO_LONG");
  assertMaxLength(input.returnUrl, MAX_URL_LENGTH, "Return URL 过长", "PAYMENT_RETURN_URL_TOO_LONG");
  assertMaxLength(input.alipayAppId, MAX_SECRET_LENGTH, "支付宝 App ID 过长", "ALIPAY_APP_ID_TOO_LONG");
  assertMaxLength(input.alipayPrivateKey, MAX_SECRET_LENGTH, "支付宝应用私钥过长", "ALIPAY_PRIVATE_KEY_TOO_LONG");
  assertMaxLength(input.alipayPublicKey, MAX_SECRET_LENGTH, "支付宝公钥过长", "ALIPAY_PUBLIC_KEY_TOO_LONG");
  assertMaxLength(input.stripeSecretKey, MAX_SECRET_LENGTH, "Stripe Secret Key 过长", "STRIPE_SECRET_KEY_TOO_LONG");
  assertMaxLength(input.stripeWebhookSecret, MAX_SECRET_LENGTH, "Stripe Webhook Secret 过长", "STRIPE_WEBHOOK_SECRET_TOO_LONG");
  assertMaxLength(input.stripeCurrency, 16, "Stripe 货币代码过长", "STRIPE_CURRENCY_TOO_LONG");

  const baseUrl = input.baseUrl?.trim() || "";
  if (input.isEnabled !== false && !baseUrl) {
    throw badRequestError("启用支付方式时必须填写网关地址", "PAYMENT_BASE_URL_REQUIRED");
  }

  if (input.provider === "BEPUSDT" && input.isEnabled !== false && !(input.appSecret?.trim())) {
    throw badRequestError("启用 BEpusdt 时必须填写 App Secret", "BEPUSDT_APP_SECRET_REQUIRED");
  }
  const bepusdtPaymentTypes = Array.from(
    new Set(
      [...(Array.isArray(input.paymentTypes) ? input.paymentTypes : []), input.paymentType ?? ""]
        .map((item) => String(item).trim())
        .filter(Boolean),
    ),
  );

  if (bepusdtPaymentTypes.length > MAX_PAYMENT_TYPES || bepusdtPaymentTypes.some((item) => item.length > MAX_PAYMENT_TYPE_LENGTH)) {
    throw badRequestError("BEpusdt 支付币种配置不合法", "BEPUSDT_PAYMENT_TYPES_INVALID");
  }

  if (input.provider === "BEPUSDT" && input.isEnabled !== false && bepusdtPaymentTypes.length === 0) {
    throw badRequestError("启用 BEpusdt 时必须填写支付币种", "BEPUSDT_PAYMENT_TYPE_REQUIRED");
  }

  if (input.provider === "EPAY" && input.isEnabled !== false) {
    if (!(input.pid?.trim())) {
      throw badRequestError("启用 Epay 时必须填写 PID", "EPAY_PID_REQUIRED");
    }
    if (!(input.key?.trim())) {
      throw badRequestError("启用 Epay 时必须填写 Key", "EPAY_KEY_REQUIRED");
    }
  }

  return {
    name,
    baseUrl,
  };
}
