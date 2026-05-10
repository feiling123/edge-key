<template>
  <article class="mx-auto max-w-4xl">
    <header class="mb-6 rounded-[26px] border border-base-300 bg-base-100 p-6 shadow-sm md:p-8">
      <div class="mb-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{{ t("nav.notice") }}</div>
      <h1 class="text-3xl font-black md:text-5xl">{{ t("page.notice_title") }}</h1>
    </header>

    <section class="rounded-[26px] border border-base-300 bg-base-100 p-6 shadow-sm md:p-8">
      <div class="prose max-w-none text-base-content/80" v-html="contentHtml"></div>
    </section>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { usePageContext } from "vike-vue/usePageContext";
import { useI18n } from "../../lib/client-i18n";
import { formatRichContent } from "../../lib/utils/html";

const pageContext = usePageContext();
const { locale, t } = useI18n();

const content = computed(() => {
  const site = pageContext.site;
  if (locale.value === "en") return site?.noticePageEn || site?.noticePageZh || "";
  return site?.noticePageZh || site?.noticePageEn || "";
});
const contentHtml = computed(() => formatRichContent(content.value, t("page.notice_empty")));
</script>
