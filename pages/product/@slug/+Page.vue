<template>
  <div v-if="!product" class="alert alert-warning">{{ t("product.missing") }}</div>
  <div v-else class="grid gap-6 lg:grid-cols-[1.45fr_0.8fr]">
    <section class="overflow-hidden rounded-[28px] border border-base-300 bg-base-100 shadow-sm">
      <figure class="group relative w-full overflow-hidden bg-base-200">
        <img :src="product.coverImage || emptyCoverUrl" :alt="product.name" class="max-h-[460px] w-full object-cover transition duration-500 group-hover:scale-105" />
        <div class="absolute left-5 top-5 rounded-full bg-primary px-3 py-1 text-xs font-black text-primary-content shadow-sm">{{ t("product.label") }}</div>
      </figure>
      <div class="space-y-5 p-6 md:p-8">
        <div>
          <h1 class="text-3xl font-black leading-tight md:text-5xl">{{ product.name }}</h1>
          <p class="mt-2 text-base-content/70">{{ product.subtitle }}</p>
        </div>
        <div class="prose max-w-none text-base-content/80" v-html="descriptionHtml"></div>
        <div class="rounded-2xl bg-base-200 p-4 text-sm text-base-content/80">
          {{ product.purchaseNote || t("product.default_purchase_note") }}
        </div>
      </div>
    </section>

    <aside>
      <div class="rounded-[28px] border border-base-300 bg-base-100 shadow-sm lg:sticky lg:top-24">
        <div class="space-y-4 p-6">
          <div>
            <div class="text-sm text-base-content/60">{{ t("product.price") }}</div>
            <div class="text-4xl font-black text-primary">{{ formatCents(product.price) }}</div>
          </div>
          <div class="text-sm text-base-content/70">{{ t("product.limit", { min: product.minBuy, max: product.maxBuy }) }}</div>

          <div class="divider my-0"></div>

          <label class="flex flex-col gap-1.5">
            <span class="label-text font-medium">{{ t("product.email") }}</span>
            <input v-model="form.contactValue" type="email" class="input input-bordered w-full" :placeholder="t('product.email_placeholder')" />
          </label>
          <p class="-mt-2 text-xs text-base-content/60">{{ t("product.email_tip") }}</p>

          <label class="flex flex-col gap-1.5">
            <span class="label-text font-medium">{{ t("product.quantity") }}</span>
            <input v-model.number="form.quantity" type="number" :min="product.minBuy" :max="product.maxBuy" class="input input-bordered w-full" />
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="label-text font-medium">{{ t("product.note") }}</span>
            <textarea v-model="form.buyerNote" class="textarea textarea-bordered w-full" rows="3" :placeholder="t('product.note_placeholder')"></textarea>
          </label>

          <div class="space-y-2">
            <div class="text-sm font-medium">{{ t("product.payment_method") }}</div>
            <div class="grid gap-3">
              <label
                v-for="method in paymentMethods"
                :key="paymentMethodKey(method)"
                class="rounded-2xl border border-base-300 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5"
                :class="{ 'border-primary bg-primary/5': selectedPaymentMethodKey === paymentMethodKey(method) }"
                @click="selectPaymentMethod(method)"
              >
                <div class="flex items-center justify-between gap-3">
                  <span>{{ method.label }}</span>
                  <input
                    type="radio"
                    class="radio radio-primary radio-sm"
                    :checked="selectedPaymentMethodKey === paymentMethodKey(method)"
                    @change="selectPaymentMethod(method)"
                  />
                </div>
              </label>
            </div>
          </div>

          <div v-if="form.paymentProvider === 'EPAY'" class="space-y-2">
            <div class="text-sm font-medium">{{ t("product.epay_channel") }}</div>
            <div class="grid gap-3 md:grid-cols-2">
              <label v-for="channel in epayChannels" :key="channel.value" class="rounded-2xl border border-base-300 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5">
                <div class="flex items-center justify-between gap-3">
                  <span>{{ channel.label() }}</span>
                  <input v-model="form.paymentChannel" type="radio" class="radio radio-primary radio-sm" :value="channel.value" />
                </div>
              </label>
            </div>
          </div>



          <AppButton variant="primary" :loading="submitting" :disabled="!paymentMethods.length" @click="handleCreateOrder">{{ t("product.submit") }}</AppButton>
          <p v-if="!paymentMethods.length" class="text-sm text-warning">{{ t("product.no_payment") }}</p>
          <p v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</p>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import AppButton from "../../../components/AppButton.vue";
import { normalizeTelefuncError } from "../../../lib/app-error";
import { computed, reactive, ref } from "vue";
import { useData } from "vike-vue/useData";
import { isEmail } from "../../../lib/validators/email";
import { formatCents } from "../../../lib/utils/money";
import { onCreateOrder } from "./createOrder.telefunc";
import type { PaymentMethodItem, PaymentProvider } from "../../../modules/payment/types";
import { isMobile } from "../../../lib/utils/device";
import { onMounted, watch } from "vue";
import { saveLocalOrder } from "../../../lib/local-orders";
import { useI18n } from "../../../lib/client-i18n";
import type { Data } from "./+data";
import { formatRichContent } from "../../../lib/utils/html";

import emptyCoverUrl from "../../../assets/empty.jpg";

const { product, paymentMethods } = useData<Data>();
const { l, t } = useI18n();
const submitting = ref(false);
const errorMessage = ref("");
const epayChannels = [
  { value: "alipay", label: () => l("支付宝", "Alipay") },
  { value: "wxpay", label: () => l("微信支付", "WeChat Pay") },
] as const;

function paymentMethodKey(method: Pick<PaymentMethodItem, "provider" | "paymentChannel">) {
  return `${method.provider}:${method.paymentChannel ?? ""}`;
}

const firstPaymentMethod = paymentMethods[0] ?? null;
const firstPaymentChannel =
  firstPaymentMethod?.provider === "BEPUSDT"
    ? firstPaymentMethod.paymentChannel ?? ""
    : firstPaymentMethod?.provider === "EPAY"
      ? "alipay"
      : "alipay_h5";

const form = reactive({
  quantity: product?.minBuy ?? 1,
  contactValue: "",
  buyerNote: "",
  paymentProvider: (firstPaymentMethod?.provider ?? "BEPUSDT") as PaymentProvider,
  paymentChannel: firstPaymentChannel,
});
const selectedPaymentMethodKey = ref(firstPaymentMethod ? paymentMethodKey(firstPaymentMethod) : "");
const selectedPaymentMethod = computed(() => paymentMethods.find((method) => paymentMethodKey(method) === selectedPaymentMethodKey.value) ?? paymentMethods[0] ?? null);

let mobile = false;
onMounted(() => {
  mobile = isMobile();
  if (form.paymentProvider === "ALIPAY") {
    form.paymentChannel = mobile ? "alipay_h5" : "alipay_pc";
  }
});

watch(() => form.paymentProvider, (provider) => {
  if (provider === "EPAY") form.paymentChannel = "alipay";
  else if (provider === "ALIPAY") form.paymentChannel = mobile ? "alipay_h5" : "alipay_pc";
  else if (provider !== "BEPUSDT") form.paymentChannel = "";
});

const descriptionHtml = computed(() => formatRichContent(product?.description || "", t("product.empty_description")));

function selectPaymentMethod(method: PaymentMethodItem) {
  selectedPaymentMethodKey.value = paymentMethodKey(method);
  form.paymentProvider = method.provider;
  if (method.provider === "BEPUSDT") {
    form.paymentChannel = method.paymentChannel ?? "";
  }
}

async function handleCreateOrder() {
  if (!product) return;

  const contactEmail = form.contactValue.trim();
  if (!contactEmail) {
    errorMessage.value = t("product.email_required");
    return;
  }

  if (!isEmail(contactEmail)) {
    errorMessage.value = t("product.email_invalid");
    return;
  }

  submitting.value = true;
  errorMessage.value = "";
  const paymentMethod = selectedPaymentMethod.value;

  try {
    const result = await onCreateOrder({
      productId: product.id,
      quantity: form.quantity,
      paymentProvider: paymentMethod?.provider ?? form.paymentProvider,
      paymentChannel: paymentMethod?.provider === "BEPUSDT" ? paymentMethod.paymentChannel : (form.paymentProvider === "EPAY" || form.paymentProvider === "ALIPAY" ? form.paymentChannel : undefined),
      contactType: "EMAIL",
      contactValue: contactEmail,
      buyerNote: form.buyerNote,
    });

    saveLocalOrder({
      orderNo: result.orderNo,
      queryToken: result.queryToken,
      productName: product.name,
      amount: result.amount,
      createdAt: new Date().toISOString(),
      paymentStatus: result.paymentStatus ?? 'UNPAID',
    });

    if (result.payUrl) {
      window.location.href = result.payUrl;
      return;
    }

    window.location.href = `/order/${result.orderNo}?token=${encodeURIComponent(result.queryToken)}`;
  } catch (error) {
    errorMessage.value = normalizeTelefuncError(error, t("product.create_failed"));
  } finally {
    submitting.value = false;
  }
}

</script>

<style scoped>
:deep(.prose img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1rem auto;
  border-radius: 0.85rem;
}
</style>
