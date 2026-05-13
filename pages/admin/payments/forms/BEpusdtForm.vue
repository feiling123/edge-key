<template>
  <div class="grid gap-4 md:grid-cols-2">
    <label class="flex flex-col gap-1.5">
      <span class="label-text font-medium">{{ l("商户 ID", "Merchant ID") }}</span>
      <input v-model="modelValue.merchantId" class="input input-bordered w-full" placeholder="default" />
    </label>
    <div class="flex flex-col gap-2 md:col-span-2">
      <span class="label-text font-medium">{{ l("支付币种", "Payment Currencies") }}</span>
      <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <label
          v-for="item in paymentTypes"
          :key="item"
          class="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-base-300 px-4 py-3 transition hover:border-primary/40 hover:bg-primary/5"
        >
          <span class="text-sm font-medium">{{ item }}</span>
          <input type="checkbox" class="checkbox checkbox-primary checkbox-sm" :checked="isSelected(item)" @change="togglePaymentType(item)" />
        </label>
      </div>
      <p class="text-xs text-base-content/60">{{ l("前台会按已选币种分别展示支付方式。至少保留一个币种。", "The storefront shows each selected currency as a separate payment option. Keep at least one currency selected.") }}</p>
    </div>
    <label class="flex flex-col gap-1.5">
      <span class="label-text font-medium">App Secret</span>
      <SecretInput v-model="modelValue.appSecret" />
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SecretInput from "../../../../components/SecretInput.vue";
import { useI18n } from "../../../../lib/client-i18n";
const props = defineProps<{ modelValue: Record<string, any> }>();
const { l } = useI18n();
const paymentTypes = [
  "USDT-TRC20",
  "TRX",
  "USDT-Polygon",
  "USDT-BSC",
  "USDT-ERC20",
  "USDT-ArbitrumOne",
  "USDC-ERC20",
  "USDC-Polygon",
  "USDC-BSC",
  "USDC-ArbitrumOne",
];

function normalizePaymentTypes(values: unknown[]) {
  return Array.from(new Set(values.map((item) => String(item).trim()).filter(Boolean)));
}

const selectedPaymentTypes = computed(() => {
  const configured = Array.isArray(props.modelValue.paymentTypes) ? props.modelValue.paymentTypes : [];
  const legacy = typeof props.modelValue.paymentType === "string" ? [props.modelValue.paymentType] : [];
  return normalizePaymentTypes([...configured, ...legacy]);
});

const selectedPaymentTypeSet = computed(() => new Set(selectedPaymentTypes.value));

function syncPaymentTypes(values: string[]) {
  const normalized = normalizePaymentTypes(values);
  props.modelValue.paymentTypes = normalized;
  props.modelValue.paymentType = normalized[0] ?? "";
}

function isSelected(item: string) {
  return selectedPaymentTypeSet.value.has(item);
}

function togglePaymentType(item: string) {
  const values = selectedPaymentTypes.value;
  const next = values.includes(item) ? values.filter((value) => value !== item) : [...values, item];
  syncPaymentTypes(next.length ? next : [item]);
}
</script>
