<template>
  <div class="space-y-10">
    <section class="relative overflow-hidden rounded-[28px] border border-base-300 bg-base-100 shadow-sm">
      <div class="relative min-h-[440px] p-6 md:min-h-[520px] md:p-10">
        <transition name="hero-fade" mode="out-in">
          <img :key="currentHero.image" class="absolute inset-0 h-full w-full object-cover" :src="currentHero.image" :alt="currentHero.title" />
        </transition>
        <div class="absolute inset-0 bg-gradient-to-r from-black/75 via-black/48 to-black/25"></div>
        <div class="relative z-10 flex min-h-[390px] max-w-3xl flex-col justify-center md:min-h-[450px]">
          <div v-if="site.notice || currentHero.badge" class="mb-5 inline-flex w-fit items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/20">
            <span class="size-2 rounded-full bg-emerald-400"></span>
            {{ currentHero.badge || site.notice }}
          </div>
          <h1 class="max-w-2xl text-4xl font-black leading-tight text-white md:text-6xl">
            {{ currentHero.title }}
          </h1>
          <p class="mt-4 max-w-xl text-base font-semibold leading-relaxed text-white/82 md:text-xl">
            {{ currentHero.subtitle }}
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <a :href="currentHero.href" class="inline-flex min-h-12 items-center rounded-2xl bg-primary px-6 py-3 text-base font-bold text-primary-content shadow-lg shadow-primary/20 transition duration-300 hover:-translate-y-1 hover:scale-[1.02]">
              {{ currentHero.buttonText }}
              <svg viewBox="0 0 20 20" class="ml-2 size-5" aria-hidden="true"><path fill="currentColor" d="M11.78 4.22a.75.75 0 0 0-1.06 1.06l3.97 3.97H4.75a.75.75 0 0 0 0 1.5h9.94l-3.97 3.97a.75.75 0 1 0 1.06 1.06l5.25-5.25a.75.75 0 0 0 0-1.06l-5.25-5.25Z"/></svg>
            </a>
            <a href="/products" class="inline-flex min-h-12 items-center rounded-2xl border border-white/30 bg-white/10 px-6 py-3 text-base font-bold text-white backdrop-blur transition duration-300 hover:-translate-y-1 hover:bg-white/20">
              {{ t("home.view_all") }}
            </a>
          </div>
          <div v-if="heroSlides.length > 1" class="mt-8 flex items-center gap-3">
            <button
              v-for="(_, index) in heroSlides"
              :key="index"
              type="button"
              class="h-3 rounded-full bg-white/65 transition-all duration-300 hover:scale-125 hover:bg-white"
              :class="index === currentHeroIndex ? 'w-12 bg-white' : 'w-3'"
              :aria-label="`banner ${index + 1}`"
              @click="currentHeroIndex = index"
            ></button>
          </div>
        </div>
      </div>
    </section>

    <section id="products" class="scroll-mt-28 border-t border-base-300 pt-8">
      <div class="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="mb-2 inline-flex size-7 items-center justify-center rounded-lg bg-primary/10 text-sm font-black text-primary">{{ t("home.hot_badge") }}</div>
          <h2 class="text-3xl font-black tracking-normal">{{ t("home.product_list") }}</h2>
          <p class="mt-2 text-base-content/60">{{ t("home.product_subtitle") }}</p>
        </div>
        <a href="/products" class="inline-flex w-fit items-center rounded-full bg-base-100 px-4 py-2 text-sm font-black text-primary shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-primary hover:text-primary-content">
          {{ t("home.view_all_products") }}
          <svg viewBox="0 0 20 20" class="ml-1 size-5" aria-hidden="true"><path fill="currentColor" d="M11.78 4.22a.75.75 0 0 0-1.06 1.06l3.97 3.97H4.75a.75.75 0 0 0 0 1.5h9.94l-3.97 3.97a.75.75 0 1 0 1.06 1.06l5.25-5.25a.75.75 0 0 0 0-1.06l-5.25-5.25Z"/></svg>
        </a>
      </div>
      <ProductCardGrid
        :products="homeProducts"
        :empty-message="t('home.empty')"
        grid-class="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5"
      />
    </section>

    <section v-if="latestPosts.length" class="rounded-[24px] border border-base-300 bg-base-100 p-6 shadow-sm">
      <div class="mb-5 flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-black">{{ t("home.latest") }}</h2>
          <p class="mt-1 text-sm text-base-content/60">{{ t("home.latest_subtitle") }}</p>
        </div>
        <a href="/blog" class="text-sm font-bold text-primary transition hover:scale-105">{{ t("home.view_all") }}</a>
      </div>
      <div class="grid gap-3 md:grid-cols-3">
        <a v-for="post in latestPosts" :key="post.slug" :href="`/blog/${post.slug}`" class="group grid gap-3 rounded-2xl border border-base-200 p-3 transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:bg-primary/5">
          <img :src="post.coverImage || fallbackHeroUrl" :alt="post.title" class="aspect-[16/10] w-full rounded-xl object-cover transition duration-500 group-hover:scale-[1.03]" />
          <div>
            <div class="text-xs font-semibold text-base-content/45">{{ post.date }} · {{ post.readMinutes }} min</div>
            <h3 class="mt-2 line-clamp-2 font-black transition group-hover:text-primary">{{ post.title }}</h3>
            <p class="mt-2 line-clamp-2 text-sm text-base-content/60">{{ post.excerpt }}</p>
          </div>
        </a>
      </div>
    </section>

    <section v-if="pageLinks.length" class="grid gap-5 md:grid-cols-2">
      <a v-for="page in pageLinks" :key="page.href" :href="page.href" class="rounded-[24px] border border-base-300 bg-base-100 p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:scale-[1.015] hover:border-primary/30">
        <div class="mb-4 inline-flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <svg viewBox="0 0 20 20" class="size-5" aria-hidden="true"><path fill="currentColor" d="M4.25 3A2.25 2.25 0 0 0 2 5.25v9.5A2.25 2.25 0 0 0 4.25 17h11.5A2.25 2.25 0 0 0 18 14.75v-9.5A2.25 2.25 0 0 0 15.75 3H4.25Zm1 3.5h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1 0-1.5Zm0 3h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1 0-1.5Zm0 3h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Z"/></svg>
        </div>
        <h3 class="text-xl font-black">{{ page.title }}</h3>
        <p class="mt-2 text-sm text-base-content/60">{{ page.description }}</p>
      </a>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useData } from "vike-vue/useData";
import ProductCardGrid from "../../components/ProductCardGrid.vue";
import { useI18n } from "../../lib/client-i18n";
import fallbackHeroUrl from "../../assets/home-n.png";
import type { Data } from "./+data";

interface HeroSlide {
  title: string;
  subtitle: string;
  image: string;
  href: string;
  badge: string;
  buttonText: string;
}

const { site, catalog, blog } = useData<Data>();
const { locale, t } = useI18n();
const currentHeroIndex = ref(0);
let heroTimer: number | undefined;

onMounted(() => {
  heroTimer = window.setInterval(() => {
    if (heroSlides.value.length > 1) {
      currentHeroIndex.value = (currentHeroIndex.value + 1) % heroSlides.value.length;
    }
  }, 5200);
});

onUnmounted(() => {
  if (heroTimer) window.clearInterval(heroTimer);
});

const firstProduct = computed(() => catalog.products[0] ?? null);
const localizedBlogPosts = computed(() => blog.posts.map((post) => ({
  ...post,
  title: post.title[locale.value],
  excerpt: post.excerpt[locale.value],
})));
const latestPosts = computed(() => localizedBlogPosts.value.slice(0, 3));
const homeProducts = computed(() => catalog.products.slice(0, 9));
const heroSlides = computed<HeroSlide[]>(() => {
  const productImage = firstProduct.value?.coverImage || fallbackHeroUrl;
  const blogSlides = localizedBlogPosts.value.slice(0, 5).map((post) => ({
    title: post.title,
    subtitle: post.excerpt || site.siteSubtitle || t("home.hero_subtitle"),
    image: post.coverImage || productImage,
    href: `/blog/${post.slug}`,
    badge: t("home.blog_badge"),
    buttonText: t("blog.read_more"),
  }));

  if (blogSlides.length) return blogSlides;
  if (firstProduct.value) {
    return [{
      title: firstProduct.value.name,
      subtitle: firstProduct.value.subtitle || site.siteSubtitle || t("home.hero_subtitle"),
      image: productImage,
      href: `/product/${firstProduct.value.slug}`,
      badge: site.notice || t("home.hot"),
      buttonText: t("home.view_detail"),
    }];
  }

  return [{
    title: site.siteName || "edgeKey",
    subtitle: site.siteSubtitle || t("home.hero_subtitle"),
    image: fallbackHeroUrl,
    href: "/products",
    badge: site.notice || "",
    buttonText: t("home.view_all"),
  }];
});
const currentHero = computed(() => heroSlides.value[currentHeroIndex.value] ?? heroSlides.value[0]);
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
</script>

<style scoped>
.hero-fade-enter-active,
.hero-fade-leave-active {
  transition: opacity 500ms ease, transform 500ms ease;
}

.hero-fade-enter-from,
.hero-fade-leave-to {
  opacity: 0;
  transform: scale(1.02);
}
</style>
