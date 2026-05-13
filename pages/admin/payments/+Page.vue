<template>
  <section class="space-y-6">
    <div class="alert alert-info">
      <span class="text-white">{{ l("启用支付前，请先前往“站点设置”配置网站地址，否则无法获取支付结果。", "Before enabling payments, configure the site URL in Site Settings or payment results cannot be received.") }}</span>
    </div>
    <div role="tablist" class="tabs tabs-border">
      <a role="tab" class="tab" :class="{ 'tab-active': activeTab === 'BEPUSDT' }" @click="activeTab = 'BEPUSDT'">
        BEpusdt
        <span v-if="summaryConfigs.BEPUSDT?.isEnabled" class="ml-1.5 inline-block w-2 h-2 rounded-full bg-success"></span>
      </a>
      <a role="tab" class="tab" :class="{ 'tab-active': activeTab === 'EPAY' }" @click="activeTab = 'EPAY'">
        Epay
        <span v-if="summaryConfigs.EPAY?.isEnabled" class="ml-1.5 inline-block w-2 h-2 rounded-full bg-success"></span>
      </a>
      <a role="tab" class="tab" :class="{ 'tab-active': activeTab === 'ALIPAY' }" @click="activeTab = 'ALIPAY'">
        {{ l("支付宝", "Alipay") }}
        <span v-if="summaryConfigs.ALIPAY?.isEnabled" class="ml-1.5 inline-block w-2 h-2 rounded-full bg-success"></span>
      </a>
      <a role="tab" class="tab" :class="{ 'tab-active': activeTab === 'STRIPE' }" @click="activeTab = 'STRIPE'">
        Stripe
        <span v-if="summaryConfigs.STRIPE?.isEnabled" class="ml-1.5 inline-block w-2 h-2 rounded-full bg-success"></span>
      </a>
    </div>
    <div v-if="loadError" class="alert alert-error">
      <span>{{ loadError }}</span>
    </div>
    <section v-if="!currentConfig" class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <span class="loading loading-spinner loading-sm"></span>
        <span class="text-sm text-base-content/70">{{ l("正在加载支付配置...", "Loading payment configuration...") }}</span>
      </div>
    </section>
    <PaymentConfigCard
      v-else
      :key="activeTab"
      :provider="activeTab"
      :title="providerTitle(activeTab)"
      :initial-value="currentConfig"
      @saved="handleSaved"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useData } from "vike-vue/useData";
import PaymentConfigCard from "./PaymentConfigCard.vue";
import type { Data } from "./+data";
import { useI18n } from "../../../lib/client-i18n";
import { normalizeTelefuncError } from "../../../lib/app-error";
import type { PaymentConfigValue, PaymentProvider } from "../../../modules/payment/types";

type AdminPaymentConfigSummary = Pick<PaymentConfigValue, "provider" | "name" | "isEnabled">;

const { summaries } = useData<Data>();
const { l } = useI18n();
const activeTab = ref<PaymentProvider>("BEPUSDT");

const emptyConfigs: Record<PaymentProvider, PaymentConfigValue | null> = {
  BEPUSDT: null,
  EPAY: null,
  ALIPAY: null,
  STRIPE: null,
};
const emptySummaries: Record<PaymentProvider, AdminPaymentConfigSummary | null> = {
  BEPUSDT: null,
  EPAY: null,
  ALIPAY: null,
  STRIPE: null,
};

const localConfigs = reactive<Record<PaymentProvider, PaymentConfigValue | null>>({ ...emptyConfigs });
const summaryConfigs = reactive<Record<PaymentProvider, AdminPaymentConfigSummary | null>>({
  ...emptySummaries,
  ...summaries,
});
const loadingProviders = reactive<Record<PaymentProvider, boolean>>({
  BEPUSDT: false,
  EPAY: false,
  ALIPAY: false,
  STRIPE: false,
});
const loadError = ref("");

const currentConfig = computed(() => localConfigs[activeTab.value]);

function providerTitle(provider: PaymentProvider) {
  if (provider === "BEPUSDT") return l("USDT/USDC（数字货币）", "USDT/USDC (Crypto)");
  if (provider === "EPAY") return l("易支付（聚合支付）", "Epay (Aggregator)");
  if (provider === "ALIPAY") return l("支付宝（官方）", "Alipay (Official)");
  return l("Stripe（信用卡）", "Stripe (Cards)");
}

async function loadConfig(provider: PaymentProvider) {
  if (localConfigs[provider] || loadingProviders[provider]) return;
  loadingProviders[provider] = true;
  loadError.value = "";
  try {
    const { onLoadPaymentConfig } = await import("./loadPaymentConfig.telefunc");
    const result = await onLoadPaymentConfig({ provider });
    localConfigs[provider] = result;
    summaryConfigs[provider] = {
      provider: result.provider,
      name: result.name,
      isEnabled: result.isEnabled,
    };
  } catch (error) {
    loadError.value = normalizeTelefuncError(error, l("支付配置加载失败", "Failed to load payment configuration"));
  } finally {
    loadingProviders[provider] = false;
  }
}

function handleSaved(value: PaymentConfigValue) {
  localConfigs[value.provider] = value;
  summaryConfigs[value.provider] = {
    provider: value.provider,
    name: value.name,
    isEnabled: value.isEnabled,
  };
}

watch(activeTab, (provider) => {
  void loadConfig(provider);
});

onMounted(() => {
  void loadConfig(activeTab.value);
});
</script>
