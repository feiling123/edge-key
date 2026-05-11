<template>
  <div class="mx-auto">

    <div class="tabs tabs-lift">
      <a class="tab" :class="{ 'tab-active': activeTab === 'query' }" @click="activeTab = 'query'">{{ t("query.tab_query") }}</a>
      <a class="tab" :class="{ 'tab-active': activeTab === 'local' }" @click="activeTab = 'local'">
        {{ t("query.tab_local") }}
        <span v-if="localOrders.length" class="indicator-item badge badge-primary badge-sm ml-1">{{ localOrders.length }}</span>
      </a>
    </div>

    <div v-if="activeTab === 'local'" class="card bg-base-100 shadow-sm rounded-tl-none">
      <div class="card-body">
        <div v-if="!localOrders.length" class="flex flex-col items-center gap-2 py-8 text-base-content/40">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p class="text-sm">{{ t("query.empty_local") }}</p>
        </div>

        <div v-else class="space-y-2 max-h-96 overflow-y-auto pr-1">
          <a
            v-for="o in localOrders" :key="o.orderNo"
            :href="`/order/${o.orderNo}?token=${encodeURIComponent(o.queryToken)}`"
            class="flex items-center justify-between px-4 py-3 rounded-xl border border-base-200 hover:border-primary/30 hover:bg-base-50 transition-all group"
          >
            <div class="min-w-0">
              <div class="font-mono text-sm font-semibold group-hover:text-primary transition-colors truncate">{{ o.orderNo }}</div>
              <div class="text-xs text-base-content/50 mt-0.5">{{ o.productName }}</div>
            </div>
            <div class="flex items-center gap-3 shrink-0 ml-4">
              <span v-if="o.paymentStatus" class="text-xs px-2 py-0.5 rounded-full font-medium"
                :class="o.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'">
                {{ o.paymentStatus === 'PAID' ? t("query.paid") : t("query.unpaid") }}
              </span>
              <div class="text-right">
                <div class="text-sm font-bold text-primary">{{ formatCents(o.amount) }}</div>
                <div class="text-xs text-base-content/40">{{ formatDate(o.createdAt) }}</div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-base-content/20 group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </a>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'query'" class="card bg-base-100 shadow-sm rounded-tl-none">
      <div class="card-body space-y-4">
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ t("query.order_no") }}</span>
          <input v-model="orderNo" class="input input-bordered w-full" :placeholder="t('query.order_no_placeholder')" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ t("query.email") }}</span>
          <input v-model="email" type="email" class="input input-bordered w-full" :placeholder="t('query.email_placeholder')" />
        </label>
        <div class="flex items-center gap-3">
          <AppButton variant="primary" :loading="querying" @click="handleQuery">{{ t("query.submit") }}</AppButton>
          <span v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</span>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { normalizeTelefuncError } from "../../lib/app-error";
import { ref, onMounted } from "vue";
import AppButton from "../../components/AppButton.vue";
import { onQueryOrder } from "./queryOrder.telefunc";
import { getLocalOrders, type LocalOrder } from "../../lib/local-orders";
import { formatCents } from "../../lib/utils/money";
import { useI18n } from "../../lib/client-i18n";

const activeTab = ref<"local" | "query">("query");
const orderNo = ref("");
const email = ref("");
const errorMessage = ref("");
const querying = ref(false);
const localOrders = ref<LocalOrder[]>([]);
const { locale, t } = useI18n();

onMounted(() => {
  localOrders.value = getLocalOrders();
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(locale.value === "zh" ? "zh-CN" : "en-US", { dateStyle: "short", timeStyle: "short" });
}

async function handleQuery() {
  errorMessage.value = "";
  querying.value = true;

  try {
    const result = await onQueryOrder({
      orderNo: orderNo.value,
      email: email.value,
    });

    if (!result) {
      errorMessage.value = t("query.not_found");
      return;
    }

    window.location.href = `/order/${result.orderNo}?token=${encodeURIComponent(result.queryToken)}`;
  } catch (error) {
    errorMessage.value = normalizeTelefuncError(error, t("query.failed"));
  } finally {
    querying.value = false;
  }
}
</script>
