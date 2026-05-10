<template>
  <template v-if="isAdminRoute">
    <slot />
  </template>
  <div v-else class="min-h-screen bg-[#f7f7f8] text-base-content flex flex-col">
    <header class="sticky top-0 z-40 border-b border-base-300 bg-base-100/95 backdrop-blur">
      <div class="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 lg:px-6">
        <a href="/" class="flex min-w-0 items-center gap-2 text-primary">
          <img :src="siteLogo" height="34" width="34" class="h-8 w-8 rounded object-cover" alt="logo" />
          <span class="truncate text-2xl font-black tracking-normal md:text-3xl">{{ siteName }}</span>
        </a>

        <form class="hidden h-12 min-w-[260px] flex-1 max-w-sm items-center rounded-full border border-primary/20 bg-base-200 px-4 shadow-sm lg:flex" @submit.prevent="submitSearch">
          <svg viewBox="0 0 20 20" class="size-5 shrink-0 text-base-content/45" aria-hidden="true"><path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.383 8.823l3.147 3.147a.75.75 0 1 1-1.06 1.06l-3.147-3.147A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>
          <input v-model="searchKeyword" class="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" :placeholder="t('nav.search_placeholder')" />
          <button type="submit" class="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-content shadow-sm">{{ t("nav.search") }}</button>
        </form>

        <nav class="ml-auto hidden items-center gap-1 text-sm font-semibold text-base-content/70 lg:flex">
          <a v-for="item in navItems" :key="item.href" :href="item.href" class="rounded-full px-4 py-2 transition duration-300 hover:scale-105 hover:bg-primary/10 hover:text-primary" :class="isActive(item.match) ? 'bg-primary/10 text-primary' : ''">
            {{ item.label }}
          </a>
        </nav>

        <div class="ml-auto flex items-center gap-2 lg:ml-0">
          <a href="/query" class="hidden rounded-full px-3 py-2 text-sm font-semibold text-base-content/70 transition hover:bg-primary/10 hover:text-primary sm:inline-flex">{{ t("nav.query") }}</a>
          <LanguageSwitcher />
          <button type="button" class="inline-flex size-11 items-center justify-center rounded-full border border-base-300 bg-base-100 text-base-content/70 shadow-sm lg:hidden" :aria-label="t('nav.menu')" @click="mobileMenuOpen = !mobileMenuOpen">
            <svg v-if="!mobileMenuOpen" viewBox="0 0 20 20" class="size-6" aria-hidden="true"><path fill="currentColor" d="M3.75 5.5a.75.75 0 0 1 .75-.75h11a.75.75 0 0 1 0 1.5h-11a.75.75 0 0 1-.75-.75Zm0 4.5a.75.75 0 0 1 .75-.75h11a.75.75 0 0 1 0 1.5h-11a.75.75 0 0 1-.75-.75Zm0 4.5a.75.75 0 0 1 .75-.75h11a.75.75 0 0 1 0 1.5h-11a.75.75 0 0 1-.75-.75Z"/></svg>
            <svg v-else viewBox="0 0 20 20" class="size-6" aria-hidden="true"><path fill="currentColor" d="M5.22 5.22a.75.75 0 0 1 1.06 0L10 8.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-3.72 3.72a.75.75 0 1 1-1.06-1.06L8.94 10 5.22 6.28a.75.75 0 0 1 0-1.06Z"/></svg>
          </button>
        </div>
      </div>

      <div v-if="mobileMenuOpen" class="border-t border-base-300 bg-base-100 px-4 pb-4 lg:hidden">
        <form class="mt-4 flex h-12 items-center rounded-full border border-primary/20 bg-base-200 px-4" @submit.prevent="submitSearch">
          <svg viewBox="0 0 20 20" class="size-5 shrink-0 text-base-content/45" aria-hidden="true"><path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.383 8.823l3.147 3.147a.75.75 0 1 1-1.06 1.06l-3.147-3.147A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>
          <input v-model="searchKeyword" class="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" :placeholder="t('nav.search_placeholder')" />
          <button type="submit" class="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-content">{{ t("nav.search") }}</button>
        </form>
        <nav class="mt-3 grid gap-2 text-sm font-semibold">
          <a v-for="item in mobileNavItems" :key="item.href" :href="item.href" class="rounded-xl px-3 py-3 transition duration-300 hover:scale-[1.01] hover:bg-primary/10 hover:text-primary" :class="isActive(item.match) ? 'bg-primary/10 text-primary' : ''" @click="mobileMenuOpen = false">
            {{ item.label }}
          </a>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-7xl w-full px-4 py-8 flex-1 lg:px-6">
      <slot />
    </main>

    <footer class="mt-auto border-t border-base-300 bg-base-100 py-8 text-sm text-base-content/60">
      <div class="mx-auto grid max-w-7xl gap-6 px-4 md:grid-cols-[1.3fr_1fr_1fr] lg:px-6">
        <div>
          <div class="flex items-center gap-2">
            <img :src="siteLogo" height="28" width="28" class="h-7 w-7 rounded object-cover" alt="logo" />
            <h3 class="text-lg font-bold text-base-content">{{ siteName }}</h3>
          </div>
          <p v-if="siteSubtitle" class="mt-3 max-w-md leading-relaxed">{{ siteSubtitle }}</p>
          <p class="mt-4">
            <a :href="footerHref" :target="footerHref === '#' ? undefined : '_blank'">
              {{ footerText ? footerText : `© ${new Date().getFullYear()} ${siteName}` }}
            </a>
          </p>
        </div>
        <div>
          <h4 class="font-bold text-base-content">{{ t("nav.links") }}</h4>
          <div class="mt-3 grid max-w-sm grid-cols-2 gap-x-8 gap-y-3">
            <a v-for="item in mobileNavItems" :key="`footer-${item.href}`" :href="item.href" class="transition hover:translate-x-1 hover:text-primary">{{ item.label }}</a>
          </div>
        </div>
        <div>
          <h4 class="font-bold text-base-content">{{ t("nav.support") }}</h4>
          <template v-if="supportContactItems.length === 1">
            <p class="mt-3 flex items-center gap-2 text-sm">
              <svg class="w-4 h-4 shrink-0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.079 6.839a3 3 0 0 0-4.255.1M13 20h1.083A3.916 3.916 0 0 0 18 16.083V9A6 6 0 1 0 6 9v7m7 4v-1a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1Zm-7-4v-6H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1Zm12-6h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1v-6Z"/>
              </svg>
              <a v-if="supportContactItems[0].href" :href="supportContactItems[0].href" target="_blank" class="hover:underline">{{ supportContactItems[0].label }}</a>
              <span v-else>{{ supportContactItems[0].label }}</span>
            </p>
          </template>
          <template v-else-if="supportContactItems.length > 1">
            <ul class="mt-3 grid gap-2">
              <li v-for="(item, i) in supportContactItems" :key="i">
                <a v-if="item.href" :href="item.href" target="_blank" class="hover:text-primary">{{ item.label }}</a>
                <span v-else>{{ item.label }}</span>
              </li>
            </ul>
          </template>
          <p v-else class="mt-3">{{ t("nav.no_support") }}</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import LanguageSwitcher from "../components/LanguageSwitcher.vue";
import { usePageContext } from "vike-vue/usePageContext";
import { useI18n } from "../lib/client-i18n";

import logoUrl from "../assets/logo.svg";

const pageContext = usePageContext();
const { t } = useI18n();
const searchKeyword = ref("");
const mobileMenuOpen = ref(false);
const siteName = computed(() => pageContext.site?.siteName || "edgeKey");
const siteSubtitle = computed(() => pageContext.site?.siteSubtitle || "");
const siteLogo = computed(() => pageContext.site?.logo || logoUrl);
const footerHref = computed(() => pageContext.site?.siteUrl || "#");
const currentPath = computed(() => pageContext.urlPathname || "/");
const navItems = computed(() => [
  { href: "/", match: "/", label: t("nav.home") },
  { href: "/products", match: "/products", label: t("nav.products") },
  { href: "/blog", match: "/blog", label: t("nav.blog") },
  { href: "/notice", match: "/notice", label: t("nav.notice") },
  { href: "/about", match: "/about", label: t("nav.about") },
]);
const mobileNavItems = computed(() => [
  ...navItems.value,
  { href: "/query", match: "/query", label: t("nav.query") },
]);
const supportContactItems = computed(() => {
  const raw = pageContext.site?.supportContact ?? "";
  if (!raw) return [];
  return raw.split("\n").map(line => line.trim()).filter(Boolean).map(line => {
    const idx = line.indexOf("|");
    if (idx === -1) return { label: line, href: "" };
    return { label: line.slice(0, idx).trim(), href: line.slice(idx + 1).trim() };
  });
});
const footerText = computed(() => pageContext.site?.footerText || "");

const isAdminRoute = computed(() => pageContext.urlPathname?.startsWith("/admin"));

function isActive(match: string) {
  if (match === "/") return currentPath.value === "/";
  return currentPath.value.startsWith(match);
}

function submitSearch() {
  const keyword = searchKeyword.value.trim();
  mobileMenuOpen.value = false;
  if (!keyword) {
    window.location.href = "/products";
    return;
  }
  window.location.href = `/products?q=${encodeURIComponent(keyword)}`;
}
</script>

<style>
body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

* {
  box-sizing: border-box;
}

a {
  color: inherit;
  text-decoration: none;
}
</style>
