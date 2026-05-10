<template>
  <div v-if="!post" class="alert alert-warning">{{ t("blog.not_found") }}</div>
  <article v-else class="mx-auto max-w-5xl space-y-6">
    <a href="/blog" class="inline-flex items-center rounded-full bg-base-100 px-4 py-2 text-sm font-bold text-base-content/60 shadow-sm transition hover:-translate-x-1 hover:text-primary">
      ← {{ t("blog.back") }}
    </a>

    <section class="overflow-hidden rounded-[28px] border border-base-300 bg-base-100 shadow-sm">
      <img v-if="post.coverImage" :src="post.coverImage" :alt="localizedPost.title" class="max-h-[420px] w-full object-cover" />
      <div class="px-6 py-10 md:px-10 md:py-14">
        <div class="flex flex-wrap items-center gap-2 text-xs font-bold text-base-content/50">
          <span class="rounded-full bg-primary/10 px-3 py-1 text-primary">{{ categoryName(post.categoryId) }}</span>
          <time :datetime="post.date">{{ post.date }}</time>
          <span>{{ post.readMinutes }} min</span>
        </div>
        <h1 class="mt-5 max-w-3xl text-3xl font-black leading-tight text-base-content md:text-5xl">{{ localizedPost.title }}</h1>
        <div class="prose mt-8 max-w-none text-base-content/80" v-html="localizedPost.contentHtml"></div>
      </div>
    </section>

    <section v-if="localizedRelated.length" class="rounded-[24px] border border-base-300 bg-base-100 p-6 shadow-sm">
      <h2 class="text-lg font-black">{{ t("blog.related") }}</h2>
      <div class="mt-4 grid gap-4 md:grid-cols-3">
        <a v-for="item in localizedRelated" :key="item.slug" :href="`/blog/${item.slug}`" class="group overflow-hidden rounded-2xl border border-base-200 transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
          <img :src="item.coverImage || fallbackBlogImage" :alt="item.title" class="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-110" />
          <div class="p-4">
            <div class="text-xs font-semibold text-base-content/45">{{ item.date }}</div>
            <h3 class="mt-2 line-clamp-2 font-black transition group-hover:text-primary">{{ item.title }}</h3>
          </div>
        </a>
      </div>
    </section>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vike-vue/useData";
import { useI18n } from "../../../lib/client-i18n";
import fallbackBlogImage from "../../../assets/home-n.png";
import type { Data } from "./+data";

const { post, categories, related } = useData<Data>();
const { locale, t } = useI18n();

const localizedPost = computed(() => ({
  title: post?.title[locale.value] || "",
  contentHtml: post?.contentHtml[locale.value] || "",
}));

const localizedRelated = computed(() => related.map((item) => ({
  slug: item.slug,
  title: item.title[locale.value],
  date: item.date,
  coverImage: item.coverImage,
})));

function categoryName(id: string) {
  const category = categories.find((item) => item.id === id);
  return category?.name[locale.value] || t("admin.blog.no_category");
}
</script>

<style scoped>
:deep(.prose img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1.5rem auto;
  border-radius: 1rem;
}
</style>
