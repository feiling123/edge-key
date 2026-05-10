<template>
  <div class="space-y-10">
    <section class="overflow-hidden rounded-[28px] border border-base-300 bg-base-100 shadow-sm">
      <div class="relative min-h-[420px] p-6 md:min-h-[500px] md:p-10">
        <img class="absolute inset-0 h-full w-full object-cover" :src="heroImage" :alt="heroTitle" />
        <div class="absolute inset-0 bg-black/55"></div>
        <div class="relative z-10 flex min-h-[360px] max-w-3xl flex-col justify-center md:min-h-[420px]">
          <div v-if="site.notice" class="mb-5 inline-flex w-fit items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/20">
            <span class="size-2 rounded-full bg-emerald-400"></span>
            {{ site.notice }}
          </div>
          <h1 class="max-w-2xl text-4xl font-black leading-tight text-white md:text-6xl">
            {{ heroTitle }}
          </h1>
          <p class="mt-4 max-w-xl text-base font-semibold leading-relaxed text-white/80 md:text-xl">
            {{ heroSubtitle }}
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <a :href="heroHref" class="inline-flex min-h-12 items-center rounded-2xl bg-primary px-6 py-3 text-base font-bold text-primary-content shadow-lg shadow-primary/20 transition hover:-translate-y-0.5">
              {{ heroButtonText }}
              <svg viewBox="0 0 20 20" class="ml-2 size-5" aria-hidden="true"><path fill="currentColor" d="M11.78 4.22a.75.75 0 0 0-1.06 1.06l3.97 3.97H4.75a.75.75 0 0 0 0 1.5h9.94l-3.97 3.97a.75.75 0 1 0 1.06 1.06l5.25-5.25a.75.75 0 0 0 0-1.06l-5.25-5.25Z"/></svg>
            </a>
            <a href="#products" class="inline-flex min-h-12 items-center rounded-2xl border border-white/30 bg-white/10 px-6 py-3 text-base font-bold text-white backdrop-blur transition hover:bg-white/20">
              {{ t("home.view_all") }}
            </a>
          </div>
        </div>
      </div>
    </section>

    <section id="products" class="border-t border-base-300 pt-8">
      <div class="mb-6 flex items-end justify-between gap-4">
        <div>
          <div class="mb-2 inline-flex size-7 items-center justify-center rounded-lg bg-primary/10 text-sm font-black text-primary">{{ t("home.hot_badge") }}</div>
          <h2 class="text-3xl font-black tracking-normal">{{ t("home.product_list") }}</h2>
          <p class="mt-2 text-base-content/60">{{ t("home.product_subtitle") }}</p>
        </div>
        <a href="#products" class="hidden text-sm font-bold text-base-content/60 hover:text-primary sm:inline-flex">{{ t("home.view_all") }}</a>
      </div>

      <div v-if="catalog.categories.length" class="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          class="shrink-0 rounded-full px-4 py-2 text-sm font-bold transition"
          :class="activeCategoryId === null ? 'bg-primary text-primary-content shadow-sm' : 'bg-base-100 text-base-content/70 hover:bg-primary/10 hover:text-primary'"
          @click="activeCategoryId = null"
        >
          {{ t("home.all_products") }}
        </button>
        <button
          v-for="category in catalog.categories"
          :key="category.id"
          class="shrink-0 rounded-full px-4 py-2 text-sm font-bold transition"
          :class="activeCategoryId === category.id ? 'bg-primary text-primary-content shadow-sm' : 'bg-base-100 text-base-content/70 hover:bg-primary/10 hover:text-primary'"
          @click="activeCategoryId = category.id"
        >
          {{ category.name }}
        </button>
      </div>

      <div v-if="filteredProducts.length" class="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
        <article v-for="product in filteredProducts" :key="product.id" class="group overflow-hidden rounded-[20px] border border-base-300 bg-base-100 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
          <a :href="`/product/${product.slug}`" class="block">
            <div class="relative aspect-[4/3] overflow-hidden bg-base-200">
              <img :src="product.coverImage || emptyCoverUrl" :alt="product.name" class="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              <div class="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-xs font-black text-primary-content shadow-sm">
                {{ t("home.hot") }}
              </div>
              <div v-if="product.categoryName" class="absolute right-3 top-3 max-w-[70%] truncate rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
                {{ product.categoryName }}
              </div>
            </div>
            <div class="space-y-3 p-4">
              <h3 class="line-clamp-2 min-h-[2.75rem] text-sm font-black leading-snug md:text-base">{{ product.name }}</h3>
              <p class="line-clamp-2 min-h-[2.25rem] text-xs leading-relaxed text-base-content/60 md:text-sm">{{ product.subtitle || t("home.default_product_desc") }}</p>
              <div class="flex items-center justify-between gap-2">
                <div class="text-lg font-black text-primary md:text-xl">{{ formatCents(product.price) }}</div>
                <span class="inline-flex size-9 items-center justify-center rounded-full bg-base-200 text-base-content/60 transition group-hover:bg-primary group-hover:text-primary-content">
                  <svg viewBox="0 0 20 20" class="size-5" aria-hidden="true"><path fill="currentColor" d="M11.78 4.22a.75.75 0 0 0-1.06 1.06l3.97 3.97H4.75a.75.75 0 0 0 0 1.5h9.94l-3.97 3.97a.75.75 0 1 0 1.06 1.06l5.25-5.25a.75.75 0 0 0 0-1.06l-5.25-5.25Z"/></svg>
                </span>
              </div>
            </div>
          </a>
        </article>
      </div>

      <div v-else class="rounded-[22px] border border-dashed border-base-300 bg-base-100 p-10 text-center text-base-content/60">
        {{ emptyMessage }}
      </div>
    </section>

    <section v-if="latestPosts.length || pageLinks.length" class="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <div v-if="latestPosts.length" class="rounded-[24px] border border-base-300 bg-base-100 p-6 shadow-sm">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-black">{{ t("home.latest") }}</h2>
            <p class="mt-1 text-sm text-base-content/60">{{ t("home.latest_subtitle") }}</p>
          </div>
          <a href="/blog" class="text-sm font-bold text-primary">{{ t("home.view_all") }}</a>
        </div>
        <div class="grid gap-3">
          <a v-for="post in latestPosts" :key="post.slug" :href="`/blog/${post.slug}`" class="rounded-2xl border border-base-200 p-4 transition hover:border-primary/30 hover:bg-primary/5">
            <div class="text-xs font-semibold text-base-content/45">{{ post.date }} · {{ post.readMinutes }} min</div>
            <h3 class="mt-2 line-clamp-2 font-black">{{ post.title }}</h3>
            <p class="mt-2 line-clamp-2 text-sm text-base-content/60">{{ post.excerpt }}</p>
          </a>
        </div>
      </div>

      <div v-if="pageLinks.length" class="grid gap-5">
        <a v-for="page in pageLinks" :key="page.href" :href="page.href" class="rounded-[24px] border border-base-300 bg-base-100 p-6 shadow-sm transition hover:-translate-y-1 hover:border-primary/30">
          <div class="mb-4 inline-flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <svg viewBox="0 0 20 20" class="size-5" aria-hidden="true"><path fill="currentColor" d="M4.25 3A2.25 2.25 0 0 0 2 5.25v9.5A2.25 2.25 0 0 0 4.25 17h11.5A2.25 2.25 0 0 0 18 14.75v-9.5A2.25 2.25 0 0 0 15.75 3H4.25Zm1 3.5h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1 0-1.5Zm0 3h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1 0-1.5Zm0 3h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Z"/></svg>
          </div>
          <h3 class="text-xl font-black">{{ page.title }}</h3>
          <p class="mt-2 text-sm text-base-content/60">{{ page.description }}</p>
        </a>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useData } from "vike-vue/useData";
import { formatCents } from "../../lib/utils/money";
import { useI18n } from "../../lib/client-i18n";
import emptyCoverUrl from "../../assets/empty.jpg";
import fallbackHeroUrl from "../../assets/home-n.png";
import type { Data } from "./+data";

const { site, catalog, blog } = useData<Data>();
const { locale, t } = useI18n();
const activeCategoryId = ref<number | null>(null);
const keyword = ref("");

onMounted(() => {
  keyword.value = new URLSearchParams(window.location.search).get("q")?.trim() || "";
});

const heroProduct = computed(() => catalog.products[0] ?? null);
const heroImage = computed(() => heroProduct.value?.coverImage || fallbackHeroUrl);
const heroTitle = computed(() => heroProduct.value?.name || site.siteName || "edgeKey");
const heroSubtitle = computed(() => heroProduct.value?.subtitle || site.siteSubtitle || t("home.hero_subtitle"));
const heroHref = computed(() => heroProduct.value ? `/product/${heroProduct.value.slug}` : "#products");
const heroButtonText = computed(() => heroProduct.value ? t("home.view_detail") : t("home.view_all"));
const latestPosts = computed(() => blog.posts.slice(0, 3).map((post) => ({
  ...post,
  title: post.title[locale.value],
  excerpt: post.excerpt[locale.value],
})));
const pageLinks = computed(() => [
  site.noticePageZh || site.noticePageEn
    ? {
        href: "/notice",
        title: t("nav.notice"),
        description: t("home.notice_desc"),
      }
    : null,
  site.aboutPageZh || site.aboutPageEn
    ? {
        href: "/about",
        title: t("nav.about"),
        description: t("home.about_desc"),
      }
    : null,
].filter(Boolean) as Array<{ href: string; title: string; description: string }>);
const filteredProducts = computed(() => {
  const selected = activeCategoryId.value === null
    ? catalog.products
    : catalog.products.filter((product) => product.categoryId === activeCategoryId.value);
  const q = keyword.value.toLowerCase();
  if (!q) return selected;
  return selected.filter((product) => [product.name, product.subtitle, product.categoryName].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)));
});
const emptyMessage = computed(() => keyword.value ? t("home.search_empty") : t("home.empty"));
</script>
