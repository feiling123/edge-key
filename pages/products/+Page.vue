<template>
  <div class="space-y-6">
    <header class="space-y-3">
      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="text-4xl font-black tracking-normal md:text-5xl">{{ t("nav.products") }}</h1>
          <p class="mt-3 max-w-2xl text-base font-semibold text-base-content/60">{{ t("home.product_subtitle") }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="item in sortOptions"
            :key="item.value"
            type="button"
            class="rounded-full px-4 py-2 text-sm font-bold transition duration-300 hover:scale-105"
            :class="sortKey === item.value ? 'bg-primary text-primary-content shadow-sm' : 'bg-base-200 text-base-content/65 hover:bg-primary/10 hover:text-primary'"
            @click="sortKey = item.value"
          >
            {{ item.label }}
          </button>
          <span class="rounded-full bg-base-200 px-3 py-2 text-sm font-bold text-base-content/55">{{ t("home.product_count", { count: visibleCount }) }}</span>
        </div>
      </div>
    </header>

    <ProductCatalog
      v-model:sort-key="sortKey"
      :categories="catalog.categories"
      :products="catalog.products"
      :show-list-header="false"
      @update:visible-count="visibleCount = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useData } from "vike-vue/useData";
import ProductCatalog from "../../components/ProductCatalog.vue";
import { useI18n } from "../../lib/client-i18n";
import type { Data } from "./+data";

type SortKey = "default" | "price" | "name";

const { catalog } = useData<Data>();
const { t } = useI18n();
const sortKey = ref<SortKey>("default");
const visibleCount = ref(catalog.products.length);
const sortOptions = computed(() => [
  { value: "default" as const, label: t("home.sort_default") },
  { value: "price" as const, label: t("home.sort_price") },
  { value: "name" as const, label: t("home.sort_name") },
]);
</script>
