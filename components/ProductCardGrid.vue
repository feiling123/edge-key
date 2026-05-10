<template>
  <div v-if="products.length" :class="gridClass">
    <article v-for="product in products" :key="product.id" class="group overflow-hidden rounded-[18px] border border-base-300 bg-base-100 shadow-sm transition duration-300 hover:-translate-y-1.5 hover:scale-[1.015] hover:border-primary/30 hover:shadow-xl">
      <a :href="`/product/${product.slug}`" class="block">
        <div class="relative aspect-[4/3] overflow-hidden bg-base-200">
          <img :src="product.coverImage || emptyCoverUrl" :alt="product.name" class="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
          <div v-if="product.categoryName" class="absolute left-3 top-3 max-w-[80%] truncate rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
            {{ product.categoryName }}
          </div>
        </div>
        <div class="space-y-3 p-4">
          <h3 class="line-clamp-2 min-h-[2.75rem] text-sm font-black leading-snug md:text-base">{{ product.name }}</h3>
          <p class="line-clamp-2 min-h-[2.25rem] text-xs leading-relaxed text-base-content/60 md:text-sm">{{ product.subtitle || t("home.default_product_desc") }}</p>
          <div class="flex items-end justify-between gap-2">
            <div>
              <div class="text-[11px] font-bold uppercase tracking-wide text-base-content/35">CNY</div>
              <div class="text-lg font-black text-primary md:text-xl">{{ formatCents(product.price).replace("¥", "") }}</div>
            </div>
            <span class="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">{{ t("home.auto_delivery") }}</span>
          </div>
        </div>
      </a>
    </article>
  </div>

  <div v-else class="rounded-[22px] border border-dashed border-base-300 bg-base-100 p-10 text-center text-base-content/60">
    {{ emptyMessage }}
  </div>
</template>

<script setup lang="ts">
import emptyCoverUrl from "../assets/empty.jpg";
import { useI18n } from "../lib/client-i18n";
import { formatCents } from "../lib/utils/money";
import type { ProductSummary } from "../modules/catalog/types";

withDefaults(defineProps<{
  products: ProductSummary[];
  emptyMessage: string;
  gridClass?: string;
}>(), {
  gridClass: "grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4",
});

const { t } = useI18n();
</script>
