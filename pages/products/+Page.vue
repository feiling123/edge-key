<template>
  <div class="space-y-6">
    <header class="space-y-3">
      <h1 class="text-4xl font-black tracking-normal md:text-5xl">{{ t("nav.products") }}</h1>
      <p class="max-w-2xl text-base font-semibold text-base-content/60">{{ t("home.product_subtitle") }}</p>
    </header>

    <ProductCatalog :categories="catalog.categories" :products="catalog.products" />
  </div>
</template>

<script setup lang="ts">
import { useData } from "vike-vue/useData";
import ProductCatalog from "../../components/ProductCatalog.vue";
import { useI18n } from "../../lib/client-i18n";
import type { Data } from "./+data";

const { catalog } = useData<Data>();
const { t } = useI18n();
</script>
