<template>
  <section class="grid gap-6 lg:grid-cols-[280px_1fr]">
    <aside class="space-y-4 lg:sticky lg:top-24 lg:self-start">
      <div class="rounded-[22px] border border-base-300 bg-base-100 p-4 shadow-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-black text-base-content/60">{{ t("home.category_title") }}</h2>
          <span class="rounded-full bg-base-200 px-2 py-0.5 text-xs font-bold text-base-content/50">{{ categories.length }}</span>
        </div>
        <div class="mt-3 grid gap-2">
          <button class="product-category-btn" :class="activeCategoryId === null ? 'product-category-btn-active' : ''" @click="activeCategoryId = null">
            <span class="product-category-thumb bg-primary/10 text-primary">
              <svg viewBox="0 0 20 20" class="size-5" aria-hidden="true"><path fill="currentColor" d="M4.5 4A2.5 2.5 0 0 0 2 6.5v1A2.5 2.5 0 0 0 4.5 10h1A2.5 2.5 0 0 0 8 7.5v-1A2.5 2.5 0 0 0 5.5 4h-1Zm0 6A2.5 2.5 0 0 0 2 12.5v1A2.5 2.5 0 0 0 4.5 16h1A2.5 2.5 0 0 0 8 13.5v-1A2.5 2.5 0 0 0 5.5 10h-1Zm8-6A2.5 2.5 0 0 0 10 6.5v1a2.5 2.5 0 0 0 2.5 2.5h1A2.5 2.5 0 0 0 16 7.5v-1A2.5 2.5 0 0 0 13.5 4h-1Zm0 6a2.5 2.5 0 0 0-2.5 2.5v1a2.5 2.5 0 0 0 2.5 2.5h1a2.5 2.5 0 0 0 2.5-2.5v-1a2.5 2.5 0 0 0-2.5-2.5h-1Z"/></svg>
            </span>
            <span class="min-w-0 flex-1 text-left">
              <span class="block truncate font-black">{{ t("home.all_products") }}</span>
              <span class="text-xs opacity-65">{{ t("home.product_count", { count: products.length }) }}</span>
            </span>
          </button>
          <button
            v-for="category in categoryFilters"
            :key="category.id"
            class="product-category-btn"
            :class="activeCategoryId === category.id ? 'product-category-btn-active' : ''"
            @click="activeCategoryId = category.id"
          >
            <span class="product-category-thumb overflow-hidden bg-base-200">
              <img :src="category.image" :alt="category.name" class="h-full w-full object-cover" />
            </span>
            <span class="min-w-0 flex-1 text-left">
              <span class="block truncate font-black">{{ category.name }}</span>
              <span class="text-xs opacity-65">{{ t("home.product_count", { count: category.count }) }}</span>
            </span>
          </button>
        </div>
      </div>
    </aside>

    <div class="min-w-0">
      <div class="mb-5 flex flex-col gap-4 rounded-[22px] border border-base-300 bg-base-100 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 class="text-2xl font-black md:text-3xl">{{ t("home.product_list") }}</h2>
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
          <span class="rounded-full bg-base-200 px-3 py-2 text-sm font-bold text-base-content/55">{{ t("home.product_count", { count: sortedProducts.length }) }}</span>
        </div>
      </div>

      <ProductCardGrid :products="sortedProducts" :empty-message="emptyMessage" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import emptyCoverUrl from "../assets/empty.jpg";
import { useI18n } from "../lib/client-i18n";
import type { CategorySummary, ProductSummary } from "../modules/catalog/types";
import ProductCardGrid from "./ProductCardGrid.vue";

const props = withDefaults(defineProps<{
  categories: CategorySummary[];
  products: ProductSummary[];
  initialKeyword?: string;
}>(), {
  initialKeyword: "",
});

const { t } = useI18n();
const activeCategoryId = ref<number | null>(null);
const keyword = ref("");
const sortKey = ref<"default" | "price" | "name">("default");

const categories = computed(() => props.categories);
const products = computed(() => props.products);

onMounted(() => {
  keyword.value = props.initialKeyword || new URLSearchParams(window.location.search).get("q")?.trim() || "";
});

const categoryFilters = computed(() => categories.value.map((category) => {
  const categoryProducts = products.value.filter((product) => product.categoryId === category.id);
  return {
    ...category,
    count: categoryProducts.length,
    image: categoryProducts.find((product) => product.coverImage)?.coverImage || emptyCoverUrl,
  };
}));

const sortOptions = computed(() => [
  { value: "default" as const, label: t("home.sort_default") },
  { value: "price" as const, label: t("home.sort_price") },
  { value: "name" as const, label: t("home.sort_name") },
]);

const filteredProducts = computed(() => {
  const selected = activeCategoryId.value === null
    ? products.value
    : products.value.filter((product) => product.categoryId === activeCategoryId.value);
  const q = keyword.value.toLowerCase();
  if (!q) return selected;
  return selected.filter((product) => [product.name, product.subtitle, product.categoryName].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)));
});

const sortedProducts = computed(() => {
  const items = [...filteredProducts.value];
  if (sortKey.value === "price") {
    return items.sort((a, b) => a.price - b.price || a.id - b.id);
  }
  if (sortKey.value === "name") {
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }
  return items;
});

const emptyMessage = computed(() => keyword.value ? t("home.search_empty") : t("home.empty"));
</script>

<style scoped>
.product-category-btn {
  display: flex;
  min-height: 4rem;
  align-items: center;
  gap: 0.75rem;
  border-radius: 1rem;
  padding: 0.65rem;
  color: color-mix(in oklab, currentColor 78%, transparent);
  transition: transform 180ms ease, background-color 180ms ease, color 180ms ease, box-shadow 180ms ease;
}

.product-category-btn:hover {
  transform: scale(1.02);
  background: color-mix(in oklab, var(--color-primary) 8%, transparent);
  color: var(--color-primary);
}

.product-category-btn-active {
  background: var(--color-primary);
  color: var(--color-primary-content);
  box-shadow: 0 14px 26px color-mix(in oklab, var(--color-primary) 22%, transparent);
}

.product-category-btn-active:hover {
  color: var(--color-primary-content);
}

.product-category-thumb {
  display: inline-flex;
  height: 2.8rem;
  width: 2.8rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.85rem;
}
</style>
