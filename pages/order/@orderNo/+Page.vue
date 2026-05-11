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
          <div class="flex gap-2">
            <StatusTag :type="getOrderStatusType(order.status)">{{ orderStatusLabel(order.status) }}</StatusTag>
            <StatusTag :type="getPaymentStatusType(order.paymentStatus)">{{ paymentStatusLabel(order.paymentStatus) }}</StatusTag>
            <StatusTag :type="getDeliveryStatusType(order.deliveryStatus)">{{ deliveryStatusLabel(order.deliveryStatus) }}</StatusTag>
          </div>
        </div>
      </div>
    </section>

    <section class="grid gap-6 lg:grid-cols-2">
      <article class="card bg-base-100 shadow-sm">
        <div class="card-body">
          <h2 class="card-title">{{ t("order.info") }}</h2>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between"><span>{{ t("order.product") }}</span><span>{{ order.productName }}</span></div>
            <div class="flex justify-between"><span>{{ t("order.quantity") }}</span><span>{{ order.quantity }}</span></div>
            <div class="flex justify-between"><span>{{ t("order.amount") }}</span><span>{{ formatCents(order.amount) }}</span></div>
            <div class="flex justify-between"><span>{{ t("order.payment") }}</span><span>{{ getPaymentProviderLabel(order.paymentProvider) }}</span></div>
          </div>
          <div v-if="order.paymentStatus === 'UNPAID'" class="mt-4">
            <AppButton size="sm" variant="primary" :loading="paying" @click="handleContinuePay">{{ t("order.continue_pay") }}</AppButton>
            <p v-if="syncing" class="mt-2 text-sm text-base-content/60">{{ t("order.syncing") }}</p>
            <p v-if="paymentError" class="mt-2 text-sm text-error">{{ paymentError }}</p>
          </div>
        </div>
      </article>

      <article class="card bg-base-100 shadow-sm">
        <div class="card-body">
          <h2 class="card-title">{{ t("order.delivery") }}</h2>
          <div v-if="order.deliveryContents.length" class="space-y-2">
            <pre v-for="content in order.deliveryContents" :key="content" class="rounded-box bg-base-200 p-3 text-sm">{{ content }}</pre>
          </div>
          <p v-else class="text-sm text-base-content/60">{{ t("order.delivery_empty") }}</p>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { normalizeTelefuncError } from "../../../lib/app-error";
import { onBeforeUnmount, ref, onMounted } from "vue";
import AppButton from "../../../components/AppButton.vue";
import { useData } from "vike-vue/useData";
import { formatCents } from "../../../lib/utils/money";
import { getDeliveryStatusType, getOrderStatusType, getPaymentProviderLabel, getPaymentStatusType } from "../../../lib/utils/order-status";
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
const maxPollAttempts = 100;

onMounted(async () => {
  if (!order.value) return;
  startStatusPolling(1200);
  if (order.value.paymentStatus !== "UNPAID" || order.value.paymentProvider !== "ALIPAY") return;
  const params = new URLSearchParams(window.location.search);
  if (!params.get("out_trade_no")) return;
  try {
    const result = await onQueryAlipayPayment({ orderNo: order.value.orderNo });
    if (result.isPaid || result.alreadyPaid) await refreshOrderStatus();
  } catch {}
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
  return Boolean(current && (current.paymentStatus !== "PAID" || current.deliveryStatus === "NOT_DELIVERED"));
}

function stopStatusPolling() {
  if (pollTimer) window.clearTimeout(pollTimer);
  pollTimer = undefined;
  syncing.value = false;
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
    await refreshOrderStatus();
    startStatusPolling(order.value?.paymentStatus === "PAID" ? 1500 : 3000);
  }, delayMs);
}

async function refreshOrderStatus() {
  const current = order.value;
  if (!current) return;

  let latest: Data["order"];
  try {
    latest = await onQueryOrder({
      orderNo: current.orderNo,
      queryToken: current.queryToken,
    });
  } catch {
    return;
  }

  if (!latest) return;
  order.value = latest;
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
</script>
