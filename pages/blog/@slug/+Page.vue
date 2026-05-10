<template>
  <div v-if="!post" class="alert alert-warning">{{ t("blog.not_found") }}</div>
  <article v-else class="mx-auto max-w-5xl space-y-6">
    <a href="/blog" class="inline-flex items-center rounded-full bg-base-100 px-4 py-2 text-sm font-bold text-base-content/60 shadow-sm transition hover:-translate-x-1 hover:text-primary">
      ← {{ t("blog.back") }}
    </a>

    <header class="relative overflow-hidden rounded-[28px] border border-base-300 bg-base-100 shadow-sm">
      <img v-if="post.coverImage" :src="post.coverImage" :alt="localizedPost.title" class="absolute inset-0 h-full w-full object-cover" />
      <div class="absolute inset-0" :class="post.coverImage ? 'bg-gradient-to-r from-black/78 via-black/48 to-black/20' : 'bg-base-100'"></div>
      <div class="relative z-10 px-6 py-10 md:px-10 md:py-14" :class="post.coverImage ? 'text-white' : 'text-base-content'">
        <div class="flex flex-wrap items-center gap-2 text-xs font-bold" :class="post.coverImage ? 'text-white/70' : 'text-base-content/50'">
          <span class="rounded-full px-3 py-1" :class="post.coverImage ? 'bg-white/15 text-white' : 'bg-primary/10 text-primary'">{{ categoryName(post.categoryId) }}</span>
          <time :datetime="post.date">{{ post.date }}</time>
          <span>{{ post.readMinutes }} min</span>
        </div>
        <h1 class="mt-5 max-w-3xl text-3xl font-black leading-tight md:text-5xl" :class="post.coverImage ? 'text-white' : 'text-base-content'">{{ localizedPost.title }}</h1>
        <p class="mt-4 max-w-2xl text-base font-semibold leading-relaxed" :class="post.coverImage ? 'text-white/80' : 'text-base-content/65'">{{ localizedPost.excerpt }}</p>
      </div>
    </header>

    <section class="rounded-[24px] border border-base-300 bg-base-100 p-6 shadow-sm md:p-8">
      <div class="prose max-w-none text-base-content/80" v-html="localizedPost.contentHtml"></div>
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
  excerpt: post?.excerpt[locale.value] || "",
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
