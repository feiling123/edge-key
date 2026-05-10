<template>
  <div class="space-y-8">
    <header class="space-y-3">
      <h1 class="text-4xl font-black tracking-normal md:text-5xl">{{ t("blog.title") }}</h1>
      <p class="max-w-2xl text-base font-semibold text-base-content/60">{{ t("blog.subtitle") }}</p>
    </header>

    <section class="space-y-6">
      <div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
        <button class="blog-category-pill" :class="activeCategory === null ? 'blog-category-pill-active' : ''" @click="activeCategory = null">
          {{ t("blog.all_categories") }}
          <span>{{ posts.length }}</span>
        </button>
        <button
          v-for="category in localizedCategories"
          :key="category.id"
          class="blog-category-pill"
          :class="activeCategory === category.id ? 'blog-category-pill-active' : ''"
          @click="activeCategory = category.id"
        >
          {{ category.name }}
          <span>{{ categoryCount(category.id) }}</span>
        </button>
      </div>

      <div class="flex items-end justify-between gap-4">
        <div>
          <h2 class="text-2xl font-black">{{ activeCategoryName }}</h2>
          <p class="mt-1 text-sm text-base-content/55">{{ t("blog.posts") }}</p>
        </div>
        <span class="rounded-full bg-base-100 px-3 py-1 text-sm font-bold text-base-content/50 shadow-sm">{{ filteredPosts.length }}</span>
      </div>

      <div v-if="filteredPosts.length" class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="post in filteredPosts"
          :key="post.slug"
          class="group overflow-hidden rounded-[22px] border border-base-300 bg-base-100 shadow-sm transition duration-300 hover:-translate-y-1.5 hover:scale-[1.012] hover:border-primary/30 hover:shadow-xl"
        >
          <a :href="`/blog/${post.slug}`" class="block">
            <div class="relative aspect-[16/10] overflow-hidden bg-base-200">
              <img :src="post.coverImage || fallbackBlogImage" :alt="post.title" class="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
              <div class="absolute left-4 top-4 max-w-[80%] truncate rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                {{ categoryName(post.categoryId) }}
              </div>
            </div>
            <div class="p-5">
              <div class="flex flex-wrap items-center gap-2 text-xs font-semibold text-base-content/45">
                <time :datetime="post.date">{{ post.date }}</time>
                <span>·</span>
                <span>{{ post.readMinutes }} min</span>
              </div>
              <h3 class="mt-3 line-clamp-2 text-xl font-black leading-snug transition group-hover:text-primary">{{ post.title }}</h3>
              <p class="mt-3 line-clamp-3 text-sm leading-relaxed text-base-content/60">{{ post.excerpt }}</p>
              <span class="mt-5 inline-flex items-center font-bold text-primary">
                {{ t("blog.read_more") }}
                <svg viewBox="0 0 20 20" class="ml-1 size-5 transition group-hover:translate-x-1" aria-hidden="true"><path fill="currentColor" d="M11.78 4.22a.75.75 0 0 0-1.06 1.06l3.97 3.97H4.75a.75.75 0 0 0 0 1.5h9.94l-3.97 3.97a.75.75 0 1 0 1.06 1.06l5.25-5.25a.75.75 0 0 0 0-1.06l-5.25-5.25Z"/></svg>
              </span>
            </div>
          </a>
        </article>
      </div>

      <div v-else class="rounded-[24px] border border-dashed border-base-300 bg-base-100 p-10 text-center text-base-content/60">
        {{ t("blog.empty") }}
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useData } from "vike-vue/useData";
import { useI18n } from "../../lib/client-i18n";
import fallbackBlogImage from "../../assets/home-n.png";
import type { Data } from "./+data";

const { categories, posts } = useData<Data>();
const { locale, t } = useI18n();
const activeCategory = ref<string | null>(null);

const localizedCategories = computed(() => categories.map((category) => ({
  id: category.id,
  name: category.name[locale.value],
  description: category.description[locale.value],
})));

const localizedPosts = computed(() => posts.map((post) => ({
  ...post,
  title: post.title[locale.value],
  excerpt: post.excerpt[locale.value],
})));

const filteredPosts = computed(() => {
  if (!activeCategory.value) return localizedPosts.value;
  return localizedPosts.value.filter((post) => post.categoryId === activeCategory.value);
});

const activeCategoryName = computed(() => {
  if (!activeCategory.value) return t("blog.all_categories");
  return localizedCategories.value.find((category) => category.id === activeCategory.value)?.name || "";
});

function categoryName(id: string) {
  return localizedCategories.value.find((category) => category.id === id)?.name || t("admin.blog.no_category");
}

function categoryCount(id: string) {
  return posts.filter((post) => post.categoryId === id).length;
}
</script>

<style scoped>
.blog-category-pill {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.55rem;
  white-space: nowrap;
  border-radius: 999px;
  background: var(--color-base-100);
  padding: 0.65rem 1rem;
  font-size: 0.9rem;
  font-weight: 800;
  color: color-mix(in oklab, currentColor 75%, transparent);
  box-shadow: 0 1px 4px color-mix(in oklab, black 6%, transparent);
  transition: transform 180ms ease, background-color 180ms ease, color 180ms ease, box-shadow 180ms ease;
}

.blog-category-pill:hover {
  transform: scale(1.04);
  background: color-mix(in oklab, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
}

.blog-category-pill span {
  border-radius: 999px;
  background: color-mix(in oklab, currentColor 12%, transparent);
  padding: 0.1rem 0.45rem;
  font-size: 0.75rem;
}

.blog-category-pill-active {
  background: var(--color-primary);
  color: var(--color-primary-content);
  box-shadow: 0 10px 24px color-mix(in oklab, var(--color-primary) 24%, transparent);
}

.blog-category-pill-active:hover {
  color: var(--color-primary-content);
}
</style>
