<template>
  <div v-if="!order" class="alert alert-warning">{{ t("order.missing") }}</div>
  <div v-else class="space-y-6">
    <section class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <div class="flex items-start justify-between gap-4 max-md:flex-col">
          <div>
            <p class="text-sm uppercase tracking-[0.2em] text-primary">{{ t("order.label") }}</p>
            <h1 class="text-2xl font-bold">{{ order.orderNo }}</h1>
          </div>
          <div class="flex flex-wrap justify-end gap-2">
            <StatusTag :type="getPaymentStatusType(order.paymentStatus)">{{ paymentStatusLabel(order.paymentStatus) }}</StatusTag>
            <StatusTag v-if="order.paymentStatus === 'PAID' && order.deliveryStatus !== 'NOT_DELIVERED'" :type="getDeliveryStatusType(order.deliveryStatus)">{{ deliveryStatusLabel(order.deliveryStatus) }}</StatusTag>
            <StatusTag v-if="order.paymentStatus !== 'PAID'" :type="getOrderStatusType(order.status)">{{ orderStatusLabel(order.status) }}</StatusTag>
          </div>
        </div>
      </div>
    </section>

    <section class="grid gap-6 lg:grid-cols-2">
      <article class="card min-w-0 bg-base-100 shadow-sm">
        <div class="card-body min-w-0">
          <h2 class="card-title">{{ t("order.info") }}</h2>
          <dl class="grid min-w-0 grid-cols-[minmax(6rem,9rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt class="text-base-content/60">{{ t("order.product") }}</dt>
            <dd class="min-w-0 break-words text-right font-medium">{{ order.productName }}</dd>
            <dt class="text-base-content/60">{{ t("order.quantity") }}</dt>
            <dd class="min-w-0 text-right font-medium">{{ order.quantity }}</dd>
            <dt class="text-base-content/60">{{ t("order.amount") }}</dt>
            <dd class="min-w-0 text-right font-medium">{{ formatCents(order.amount) }}</dd>
            <dt class="text-base-content/60">{{ t("order.payment") }}</dt>
            <dd class="min-w-0 break-words text-right font-medium">{{ paymentDisplayName }}</dd>
          </dl>
          <div v-if="order.paymentStatus === 'UNPAID'" class="mt-4">
            <AppButton size="sm" variant="primary" :loading="paying" @click="handleContinuePay">{{ t("order.continue_pay") }}</AppButton>
            <p v-if="paymentError" class="mt-2 text-sm text-error">{{ paymentError }}</p>
          </div>
        </div>
      </article>

      <article class="card min-w-0 overflow-hidden bg-base-100 shadow-sm">
        <div class="card-body min-w-0 overflow-hidden">
          <h2 class="card-title">{{ t("order.delivery") }}</h2>
          <div v-if="deliveryContents.length" class="min-w-0 max-w-full space-y-2 overflow-hidden">
            <pre
              v-for="(content, index) in deliveryContents"
              :key="`${index}:${content.slice(0, 32)}`"
              class="block max-h-64 min-w-0 max-w-full overflow-auto whitespace-pre-wrap break-all rounded-box bg-base-200 p-3 text-sm leading-relaxed [overflow-wrap:anywhere]"
            >{{ content }}</pre>
          </div>
          <div v-else class="rounded-box border border-dashed border-base-300 bg-base-200/60 p-4">
            <div v-if="showDeliverySyncNotice" class="flex min-w-0 items-start gap-3">
              <span class="loading loading-spinner loading-sm mt-0.5 shrink-0 text-primary"></span>
              <div class="min-w-0 max-w-full">
                <p class="font-medium">{{ paymentSyncText }}</p>
                <p class="mt-1 break-words text-sm text-base-content/60">{{ deliveryEmptyText }}</p>
              </div>
            </div>
            <p v-else class="break-words text-sm text-base-content/60">{{ deliveryEmptyText }}</p>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { normalizeTelefuncError } from "../../../lib/app-error";
import { computed, onBeforeUnmount, ref, onMounted } from "vue";
import AppButton from "../../../components/AppButton.vue";
import { useData } from "vike-vue/useData";
import { formatCents } from "../../../lib/utils/money";
import { getDeliveryStatusType, getOrderStatusType, getPaymentStatusType } from "../../../lib/utils/order-status";
import StatusTag from "../../../components/StatusTag.vue";
import { onCreatePayment } from "./createPayment.telefunc";
import { onQueryAlipayPayment } from "./queryAlipayPayment.telefunc";
import { onQueryOrder } from "../../query/queryOrder.telefunc";
import { saveLocalOrder } from "../../../lib/local-orders";
import { useI18n, t as translate } from "../../../lib/client-i18n";
import type { Data } from "./+data";

const initialData = useData<Data>();
const order = ref<Data["order"]>(initialData.order);
const { t } = useI18n();
const paying = ref(false);
const paymentError = ref("");
const syncing = ref(false);
let pollTimer: ReturnType<typeof window.setTimeout> | undefined;
let pollAttempts = 0;
let refreshInFlight: Promise<void> | undefined;
const maxPollAttempts = 100;
const maxServerSyncWaitPollAttempts = 8;

onMounted(async () => {
  if (!order.value) return;

  syncing.value = shouldPoll(order.value);

  if (order.value.paymentStatus === "UNPAID" && order.value.paymentProvider === "ALIPAY") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("out_trade_no")) {
      try {
        const result = await onQueryAlipayPayment({ orderNo: order.value.orderNo });
        if (result.isPaid || result.alreadyPaid) pollAttempts = 0;
      } catch {}
    }
  }

  if (syncing.value) {
    await refreshOrderStatus({ waitForSync: true });
  }
  startStatusPolling(nextPollDelay());
});

onBeforeUnmount(() => {
  stopStatusPolling();
});

async function handleContinuePay() {
  if (!order.value) return;

  paying.value = true;
  paymentError.value = "";

  try {
    const result = await onCreatePayment({ orderId: order.value.id });
    if (result.payUrl) {
      window.location.href = result.payUrl;
      return;
    }
    paymentError.value = t("order.no_pay_url");
  } catch (error) {
    paymentError.value = normalizeTelefuncError(error, t("order.pay_failed"));
    await refreshOrderStatus();
  } finally {
    paying.value = false;
  }
}

function shouldPoll(current: Data["order"]) {
  if (!current || hasCompleteDeliveryContents(current)) return false;
  if (current.paymentStatus === "PAID") return current.deliveryStatus !== "FAILED";
  return isPendingPaymentSyncStatus(current.paymentStatus) && current.status === "PENDING";
}

const deliveryContents = computed(() => order.value?.deliveryContents ?? []);
const paymentDisplayName = computed(() => order.value?.paymentProviderName || fallbackPaymentProviderName(order.value?.paymentProvider, order.value?.paymentChannel));
const paymentSyncText = computed(() => {
  return t("order.syncing");
});

const showDeliverySyncNotice = computed(() => {
  const current = order.value;
  if (!current || hasCompleteDeliveryContents(current)) return false;
  if (isPendingPaymentSyncStatus(current.paymentStatus) && current.status === "PENDING") return true;
  if (current.paymentStatus === "PAID" && current.deliveryStatus === "FAILED") return false;

  return Boolean(current && syncing.value && current.paymentStatus === "PAID");
});

const deliveryEmptyText = computed(() => {
  if (!order.value) return t("order.delivery_empty");
  if (isPendingPaymentSyncStatus(order.value.paymentStatus) && order.value.status === "PENDING") return t("order.delivery_empty");
  if (order.value.paymentStatus === "PAID" && order.value.deliveryStatus === "FAILED") return t("order.delivery_failed_empty");
  if (order.value.paymentStatus === "PAID") return t("order.delivery_pending_empty");
  return t("order.delivery_empty");
});

function isPendingPaymentSyncStatus(status?: string) {
  return status === "UNPAID" || status === "PENDING";
}

function hasCompleteDeliveryContents(current: NonNullable<Data["order"]>) {
  return current.deliveryContents.length >= current.quantity;
}

function stopStatusPolling() {
  if (pollTimer) window.clearTimeout(pollTimer);
  pollTimer = undefined;
  syncing.value = false;
}

function nextPollDelay() {
  if (!order.value) return 1000;
  if (order.value.paymentStatus === "PAID") {
    return pollAttempts < 8 ? 600 : 1500;
  }
  if (pollAttempts < 6) return 700;
  return pollAttempts < 20 ? 2000 : 5000;
}

function startStatusPolling(delayMs: number) {
  if (!order.value || !shouldPoll(order.value) || pollAttempts >= maxPollAttempts) {
    stopStatusPolling();
    return;
  }

  if (pollTimer) window.clearTimeout(pollTimer);
  syncing.value = true;
  pollTimer = window.setTimeout(async () => {
    pollAttempts += 1;
    const current = order.value;
    await refreshOrderStatus({ waitForSync: Boolean(current && shouldUseServerSyncWait(current)) });
    startStatusPolling(nextPollDelay());
  }, delayMs);
}

function shouldUseServerSyncWait(current: NonNullable<Data["order"]>) {
  if (pollAttempts > maxServerSyncWaitPollAttempts) return false;
  if (isPendingPaymentSyncStatus(current.paymentStatus) && current.status === "PENDING") return true;
  return current.paymentStatus === "PAID" && current.deliveryStatus !== "FAILED" && !hasCompleteDeliveryContents(current);
}

async function refreshOrderStatus(options: { waitForSync?: boolean } = {}) {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = doRefreshOrderStatus(options).finally(() => {
    refreshInFlight = undefined;
  });

  return refreshInFlight;
}

async function doRefreshOrderStatus(options: { waitForSync?: boolean }) {
  const current = order.value;
  if (!current) return;

  let latest: Data["order"];
  try {
    latest = await onQueryOrder({
      orderNo: current.orderNo,
      queryToken: current.queryToken,
      waitForSync: options.waitForSync,
    });
  } catch {
    return;
  }

  if (!latest) return;
  if (`${latest.status}:${latest.paymentStatus}:${latest.deliveryStatus}` !== `${current.status}:${current.paymentStatus}:${current.deliveryStatus}`) {
    pollAttempts = 0;
  }
  order.value = latest;
  syncing.value = shouldPoll(latest);
  if (hasCompleteDeliveryContents(latest) || !syncing.value) {
    stopStatusPolling();
  }
  saveLocalOrder({
    orderNo: latest.orderNo,
    queryToken: latest.queryToken,
    productName: latest.productName,
    amount: latest.amount,
    createdAt: latest.createdAt,
    paymentStatus: latest.paymentStatus,
  });
}

function orderStatusLabel(status: string) {
  return translate(`status.order.${status}` as any);
}

function paymentStatusLabel(status: string) {
  return translate(`status.payment.${status}` as any);
}

function deliveryStatusLabel(status: string) {
  return translate(`status.delivery.${status}` as any);
}

function fallbackPaymentProviderName(provider?: string, paymentChannel?: string | null) {
  const baseName = (() => {
    if (provider === "EPAY") return "易支付";
    if (provider === "BEPUSDT") return "BEpusdt";
    if (provider === "ALIPAY") return "支付宝";
    if (provider === "STRIPE") return "Stripe";
    return "支付方式";
  })();
  const channel = paymentChannel?.trim();
  return provider === "BEPUSDT" && channel ? `${baseName} / ${channel}` : baseName;
}
</script>
