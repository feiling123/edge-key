<template>
  <section class="space-y-6">
    <div class="grid gap-4 md:grid-cols-3">
      <article class="card bg-base-100 shadow-sm"><div class="card-body"><div class="text-sm text-base-content/60">{{ l("总卡密", "Total Cards") }}</div><div class="text-3xl font-bold">{{ overview.total }}</div></div></article>
      <article class="card bg-base-100 shadow-sm"><div class="card-body"><div class="text-sm text-base-content/60">{{ l("可用库存", "Available") }}</div><div class="text-3xl font-bold text-success">{{ overview.available }}</div></div></article>
      <article class="card bg-base-100 shadow-sm"><div class="card-body"><div class="text-sm text-base-content/60">{{ l("已售出", "Sold") }}</div><div class="text-3xl font-bold text-secondary">{{ overview.sold }}</div></div></article>
    </div>

    <dialog ref="addModalRef" class="modal">
      <div class="modal-box space-y-3">
        <form method="dialog"><button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button></form>
        <h3 class="text-lg font-bold">{{ l("新增卡密", "Add Card") }}</h3>
        <select v-model="singleForm.productId" class="select select-bordered w-full">
          <option value="">{{ l("请选择商品", "Select product") }}</option>
          <option v-for="product in products" :key="product.id" :value="String(product.id)">{{ product.name }}</option>
        </select>
        <input v-model="singleForm.batchNo" class="input input-bordered w-full" :placeholder="l('批次号（可选）', 'Batch No. (optional)')" />
        <textarea v-model="singleForm.content" class="textarea textarea-bordered w-full" rows="4" :placeholder="l('输入卡密内容', 'Enter card content')"></textarea>
        <p v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</p>
        <div class="modal-action">
          <AppButton variant="primary" @click="handleCreateCard">{{ l("新增卡密", "Add Card") }}</AppButton><form method="dialog"><AppButton variant="ghost">{{ l("取消", "Cancel") }}</AppButton></form>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button>{{ l("关闭", "Close") }}</button></form>
    </dialog>

    <dialog ref="importModalRef" class="modal">
      <div class="modal-box space-y-3">
        <form method="dialog"><button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button></form>
        <h3 class="text-lg font-bold">{{ l("批量导入", "Bulk Import") }}</h3>
        <select v-model="importForm.productId" class="select select-bordered w-full">
          <option value="">{{ l("请选择商品", "Select product") }}</option>
          <option v-for="product in products" :key="product.id" :value="String(product.id)">{{ product.name }}</option>
        </select>
        <input v-model="importForm.batchNo" class="input input-bordered w-full" :placeholder="l('批次号（可选）', 'Batch No. (optional)')" />
        <textarea v-model="importForm.lines" class="textarea textarea-bordered w-full" rows="8" :placeholder="l('每行一条卡密', 'One card per line')"></textarea>
        <p v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</p>
        <div class="modal-action">
          <AppButton variant="primary" @click="handleImportCards">{{ l("导入卡密", "Import Cards") }}</AppButton>
          <form method="dialog"><AppButton variant="ghost">{{ l("取消", "Cancel") }}</AppButton></form>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button>{{ l("关闭", "Close") }}</button></form>
    </dialog>

    <dialog ref="editModalRef" class="modal">
      <div class="modal-box space-y-3">
        <form method="dialog"><button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button></form>
        <h3 class="text-lg font-bold">{{ l("编辑卡密", "Edit Card") }}</h3>
        <select v-model="editForm.productId" class="select select-bordered w-full">
          <option value="">{{ l("请选择商品", "Select product") }}</option>
          <option v-for="product in products" :key="product.id" :value="String(product.id)">{{ product.name }}</option>
        </select>
        <input v-model="editForm.batchNo" class="input input-bordered w-full" :placeholder="l('批次号（可选）', 'Batch No. (optional)')" />
        <textarea v-model="editForm.content" class="textarea textarea-bordered w-full" rows="5" :placeholder="l('输入卡密内容', 'Enter card content')"></textarea>
        <p v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</p>
        <div class="modal-action">
          <AppButton variant="primary" @click="handleUpdateCard">{{ l("保存卡密", "Save Card") }}</AppButton>
          <form method="dialog"><AppButton variant="ghost">{{ l("取消", "Cancel") }}</AppButton></form>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button>{{ l("关闭", "Close") }}</button></form>
    </dialog>

    <section class="card bg-base-100 shadow-sm">
      <div class="card-body space-y-4">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-xl font-bold">{{ l("库存列表", "Inventory") }}</h2>
          <div class="flex gap-2">
            <AppButton size="sm" variant="primary" @click="addModalRef?.showModal()">{{ l("新增卡密", "Add Card") }}</AppButton>
            <AppButton size="sm" variant="outline" @click="importModalRef?.showModal()">{{ l("批量导入", "Bulk Import") }}</AppButton>
            <AppButton size="sm" variant="danger" :disabled="!selectedCardIds.size" @click="handleDeleteSelectedCards">
              {{ l(`批量删除 (${selectedCardIds.size})`, `Delete Selected (${selectedCardIds.size})`) }}
            </AppButton>
            <AppButton size="sm" variant="danger" @click="handleDeleteUnused">{{ l("清空未售库存", "Clear Unsold") }}</AppButton>
          </div>
        </div>
        <p v-if="message" class="text-sm text-base-content/70">{{ message }}</p>

        <div class="flex flex-wrap gap-3 items-center">
          <select v-model="filter.productId" class="select select-sm select-bordered w-46">
            <option value="">{{ l("全部商品", "All products") }}</option>
            <option v-for="product in products" :key="product.id" :value="String(product.id)">{{ product.name }}</option>
          </select>
          <select v-model="filter.status" class="select select-sm select-bordered w-auto">
            <option value="">{{ l("全部状态", "All statuses") }}</option>
            <option value="UNUSED">{{ l("未售出", "Unused") }}</option>
            <option value="SOLD">{{ l("已售出", "Sold") }}</option>
            <option value="LOCKED">{{ l("锁定中", "Locked") }}</option>
            <option value="INVALID">{{ l("已失效", "Invalid") }}</option>
          </select>
          <input v-model="filter.batchNo" class="input input-sm input-bordered w-52" :placeholder="l('批次号', 'Batch No.')" />
          <input v-model="filter.startDate" type="date" class="input input-sm input-bordered w-46" />
          <input v-model="filter.endDate" type="date" class="input input-sm input-bordered w-46" />
        </div>
        <div class="flex gap-3">
          <AppButton size="sm" variant="primary" @click="handleSearch">{{ l("搜索", "Search") }}</AppButton>
          <AppButton size="sm" variant="ghost" @click="handleReset">{{ l("重置", "Reset") }}</AppButton>
        </div>

        <DataTable
          :columns="columns"
          :rows="cardPage.items"
          :total="cardPage.total"
          :page="currentPage"
          :page-size="PAGE_SIZE"
          @update:page="handlePageChange"
        >
          <template #head-select>
            <input type="checkbox" class="checkbox checkbox-sm" :checked="isCurrentPageSelected" :disabled="!currentUnusedRows.length" @change="toggleCurrentPageSelection" />
          </template>
          <template #select="{ row }">
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
              :disabled="row.status !== 'UNUSED'"
              :checked="selectedCardIds.has(row.id)"
              @change="toggleCardSelection(row.id)"
            />
          </template>
          <template #contentPreview="{ value }">
            <code>{{ value }}</code>
          </template>
          <template #status="{ value }">
            <StatusTag :type="getCardStatusType(value)">{{ getStatusLabel(value) }}</StatusTag>
          </template>
          <template #createdAt="{ value }">
            {{ formatDate(value) }}
          </template>
          <template #actions="{ row }">
            <AppButton v-if="row.status === 'UNUSED'" size="xs" variant="outline" @click="openEditCard(row)">{{ l("编辑", "Edit") }}</AppButton>
            <AppButton v-if="row.status === 'UNUSED'" size="xs" variant="danger" @click="handleDeleteCard(row.id)">{{ l("删除", "Delete") }}</AppButton>
          </template>
        </DataTable>
      </div>
    </section>
  </section>
  <ConfirmDialog ref="confirmRef" />
</template>

<script setup lang="ts">
import { computed, reactive, ref, useTemplateRef } from "vue";
import { useData } from "vike-vue/useData";
import { normalizeTelefuncError } from "../../../lib/app-error";
import ConfirmDialog from "../../../components/ConfirmDialog.vue";
import { onCreateCard } from "./createCard.telefunc";
import { onDeleteUnusedCards } from "./deleteUnusedCards.telefunc";
import { onImportCards } from "./importCards.telefunc";
import { onQueryCards } from "./queryCards.telefunc";
import { onDeleteCard } from "./deleteCard.telefunc";
import { onDeleteCards } from "./deleteCards.telefunc";
import { onUpdateCard } from "./updateCard.telefunc";
import DataTable from "../../../components/DataTable.vue";
import StatusTag from "../../../components/StatusTag.vue";
import AppButton from "../../../components/AppButton.vue";
import type { Data } from "./+data";
import { useI18n } from "../../../lib/client-i18n";

const { cards, products, overview } = useData<Data>();
const { l, locale } = useI18n();

const PAGE_SIZE = 20;
const currentPage = ref(1);
const cardPage = ref({ items: [...cards], total: cards.length });

const addModalRef = useTemplateRef<HTMLDialogElement>("addModalRef");
const importModalRef = useTemplateRef<HTMLDialogElement>("importModalRef");
const editModalRef = useTemplateRef<HTMLDialogElement>("editModalRef");
const confirmRef = useTemplateRef<InstanceType<typeof ConfirmDialog>>("confirmRef");
const message = ref("");
const errorMessage = ref("");
const selectedCardIds = ref(new Set<number>());

const filter = reactive({ productId: "", batchNo: "", status: "", startDate: "", endDate: "" });

const singleForm = reactive({ productId: "", content: "", batchNo: "" });
const importForm = reactive({ productId: "", lines: "", batchNo: "" });
const editForm = reactive({ id: 0, productId: "", content: "", batchNo: "" });

const columns = computed(() => [
  { key: "select", label: "" },
  { key: "id", label: "ID" },
  { key: "productName", label: l("商品", "Product") },
  { key: "contentPreview", label: l("卡密预览", "Card Preview") },
  { key: "batchNo", label: l("批次", "Batch") },
  { key: "status", label: l("状态", "Status") },
  { key: "orderId", label: l("订单", "Order") },
  { key: "createdAt", label: l("创建时间", "Created") },
  { key: "actions", label: l("操作", "Actions") },
]);

const currentUnusedRows = computed(() => cardPage.value.items.filter((row) => row.status === "UNUSED"));
const isCurrentPageSelected = computed(() => currentUnusedRows.value.length > 0 && currentUnusedRows.value.every((row) => selectedCardIds.value.has(row.id)));

function formatDate(value: string) {
  return new Date(value).toLocaleString(locale.value === "zh" ? "zh-CN" : "en-US");
}

function getStatusLabel(status: string) {
  return ({
    UNUSED: l("未售出", "Unused"),
    SOLD: l("已售出", "Sold"),
    LOCKED: l("锁定中", "Locked"),
    INVALID: l("已失效", "Invalid"),
  } as Record<string, string>)[status] || status;
}

function getCardStatusType(status: string): "success" | "default" | "warning" | "danger" {
  return ({ UNUSED: "success", SOLD: "default", LOCKED: "warning", INVALID: "danger" } as Record<string, "success" | "default" | "warning" | "danger">)[status] ?? "default";
}

async function fetchPage(page: number) {
  const result = await onQueryCards({
    productId: filter.productId ? Number(filter.productId) : undefined,
    batchNo: filter.batchNo || undefined,
    status: filter.status || undefined,
    startDate: filter.startDate || undefined,
    endDate: filter.endDate || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  cardPage.value = result;
  currentPage.value = page;
  selectedCardIds.value = new Set([...selectedCardIds.value].filter((id) => result.items.some((row) => row.id === id)));
}

async function handleSearch() {
  await fetchPage(1);
}

async function handleReset() {
  filter.productId = "";
  filter.batchNo = "";
  filter.status = "";
  filter.startDate = "";
  filter.endDate = "";
  await fetchPage(1);
}

async function handlePageChange(page: number) {
  await fetchPage(page);
}

function toggleCardSelection(id: number) {
  const next = new Set(selectedCardIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedCardIds.value = next;
}

function toggleCurrentPageSelection() {
  const next = new Set(selectedCardIds.value);
  if (isCurrentPageSelected.value) {
    for (const row of currentUnusedRows.value) next.delete(row.id);
  } else {
    for (const row of currentUnusedRows.value) next.add(row.id);
  }
  selectedCardIds.value = next;
}

function openEditCard(row: Data["cards"][number]) {
  errorMessage.value = "";
  editForm.id = row.id;
  editForm.productId = String(row.productId);
  editForm.content = row.content ?? "";
  editForm.batchNo = row.batchNo ?? "";
  editModalRef.value?.showModal();
}

async function handleCreateCard() {
  message.value = "";
  errorMessage.value = "";
  try {
    await onCreateCard({
      productId: Number(singleForm.productId),
      content: singleForm.content,
      batchNo: singleForm.batchNo,
    });
    singleForm.content = "";
    singleForm.batchNo = "";
    addModalRef.value?.close();
    message.value = l("新增成功", "Created");
    await fetchPage(1);
  } catch (error) {
    errorMessage.value = normalizeTelefuncError(error, l("新增失败", "Create failed"));
  }
}

async function handleUpdateCard() {
  message.value = "";
  errorMessage.value = "";
  try {
    await onUpdateCard({
      id: editForm.id,
      productId: Number(editForm.productId),
      content: editForm.content,
      batchNo: editForm.batchNo,
    });
    editModalRef.value?.close();
    message.value = l("卡密已更新", "Card updated");
    await fetchPage(currentPage.value);
  } catch (error) {
    errorMessage.value = normalizeTelefuncError(error, l("保存失败", "Save failed"));
  }
}

async function handleImportCards() {
  message.value = "";
  errorMessage.value = "";
  try {
    const result = await onImportCards({
      productId: Number(importForm.productId),
      lines: importForm.lines,
      batchNo: importForm.batchNo,
    });
    importForm.lines = "";
    importForm.batchNo = "";
    importModalRef.value?.close();
    message.value = l(`已导入 ${result.count} 条卡密`, `${result.count} card(s) imported`);
    await fetchPage(1);
  } catch (error) {
    errorMessage.value = normalizeTelefuncError(error, l("导入失败", "Import failed"));
  }
}

async function handleDeleteSelectedCards() {
  const ids = [...selectedCardIds.value];
  if (!ids.length) return;
  const ok = await confirmRef.value?.confirm({
    title: l("批量删除卡密", "Delete Cards"),
    message: l(`确认删除选中的 ${ids.length} 条未售卡密？已售卡密不会被删除。`, `Delete ${ids.length} selected unused card(s)? Sold cards will not be deleted.`),
    confirmText: l("删除", "Delete"),
    danger: true,
  });
  if (!ok) return;
  message.value = "";
  errorMessage.value = "";
  try {
    const result = await onDeleteCards({ ids });
    selectedCardIds.value = new Set();
    message.value = l(`已删除 ${result.count} 条卡密`, `${result.count} card(s) deleted`);
    await fetchPage(currentPage.value);
  } catch (error) {
    errorMessage.value = normalizeTelefuncError(error, l("删除失败", "Delete failed"));
  }
}

async function handleDeleteCard(id: number) {
  const ok = await confirmRef.value?.confirm({ title: l("删除卡密", "Delete Card"), message: l(`确认删除卡密 #${id}？此操作不可撤销。`, `Delete card #${id}? This cannot be undone.`), confirmText: l("删除", "Delete"), danger: true });
  if (!ok) return;
  message.value = "";
  errorMessage.value = "";
  try {
    await onDeleteCard({ id });
    message.value = l(`已删除卡密 #${id}`, `Card #${id} deleted`);
    await fetchPage(currentPage.value);
  } catch (error) {
    errorMessage.value = normalizeTelefuncError(error, l("删除失败", "Delete failed"));
  }
}

async function handleDeleteUnused() {
  if (!filter.productId) {
    await confirmRef.value?.alert({ title: l("提示", "Notice"), message: l("请先在筛选区选择商品", "Select a product in the filters first") });
    return;
  }
  const product = products.find(p => String(p.id) === filter.productId);
  const ok = await confirmRef.value?.confirm({ title: l("清空未售库存", "Clear Unsold Inventory"), message: l(`确认清空「${product?.name ?? filter.productId}」所有未售卡密？此操作不可撤销。`, `Clear all unsold cards for "${product?.name ?? filter.productId}"? This cannot be undone.`), confirmText: l("清空", "Clear"), danger: true });
  if (!ok) return;
  message.value = "";
  errorMessage.value = "";
  try {
    const result = await onDeleteUnusedCards({ productId: Number(filter.productId) });
    message.value = l(`已删除 ${result.count} 条未售卡密`, `${result.count} unsold card(s) deleted`);
    await fetchPage(currentPage.value);
  } catch (error) {
    errorMessage.value = normalizeTelefuncError(error, l("删除失败", "Delete failed"));
  }
}
</script>
