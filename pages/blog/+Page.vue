<template>
  <div class="space-y-8">
    <section class="relative overflow-hidden rounded-[28px] border border-base-300 bg-base-100 shadow-sm">
      <img :src="heroImage" :alt="t('blog.title')" class="absolute inset-0 h-full w-full object-cover" />
      <div class="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/20"></div>
      <div class="relative z-10 min-h-[260px] px-6 py-12 text-white md:px-10 md:py-16">
        <div class="inline-flex items-center gap-2 rounded-full bg-black/35 px-4 py-2 text-sm font-bold ring-1 ring-white/20">
          <span class="size-2 rounded-full bg-emerald-400"></span>
          {{ t("blog.title") }}
        </div>
        <h1 class="mt-5 max-w-3xl text-4xl font-black leading-tight text-white md:text-6xl">{{ t("blog.title") }}</h1>
        <p class="mt-4 max-w-2xl text-base font-semibold text-white/80 md:text-xl">{{ t("blog.subtitle") }}</p>
      </div>
    </section>

    <section class="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside class="lg:sticky lg:top-24 lg:self-start">
        <div class="rounded-[24px] border border-base-300 bg-base-100 p-4 shadow-sm">
          <h2 class="px-2 text-sm font-black text-base-content/60">{{ t("blog.categories") }}</h2>
          <div class="mt-3 grid gap-2">
            <button class="blog-category-btn" :class="activeCategory === null ? 'blog-category-btn-active' : ''" @click="activeCategory = null">
              <span>{{ t("blog.all_categories") }}</span>
              <span class="rounded-full bg-base-200 px-2 py-0.5 text-xs">{{ posts.length }}</span>
            </button>
            <button
              v-for="category in localizedCategories"
              :key="category.id"
              class="blog-category-btn"
              :class="activeCategory === category.id ? 'blog-category-btn-active' : ''"
              @click="activeCategory = category.id"
            >
              <span class="min-w-0">
                <span class="block truncate font-black">{{ category.name }}</span>
                <span v-if="category.description" class="mt-0.5 block truncate text-xs opacity-70">{{ category.description }}</span>
              </span>
              <span class="rounded-full bg-base-200 px-2 py-0.5 text-xs">{{ categoryCount(category.id) }}</span>
            </button>
          </div>
        </div>
      </aside>

      <div class="space-y-5">
        <div class="flex items-end justify-between gap-4">
          <div>
            <h2 class="text-3xl font-black">{{ t("blog.posts") }}</h2>
            <p class="mt-2 text-sm text-base-content/60">{{ activeCategoryName }}</p>
          </div>
          <span class="rounded-full bg-base-100 px-3 py-1 text-sm font-bold text-base-content/50 shadow-sm">{{ filteredPosts.length }}</span>
        </div>

        <div v-if="filteredPosts.length" class="grid gap-5 md:grid-cols-2">
          <article
            v-for="post in filteredPosts"
            :key="post.slug"
            class="group overflow-hidden rounded-[24px] border border-base-300 bg-base-100 shadow-sm transition duration-300 hover:-translate-y-1.5 hover:scale-[1.012] hover:shadow-xl"
          >
            <a :href="`/blog/${post.slug}`" class="block">
              <div class="relative aspect-[16/10] overflow-hidden bg-base-200">
                <img :src="post.coverImage || fallbackBlogImage" :alt="post.title" class="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                <div class="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white backdrop-blur">
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
                <p class="mt-3 line-clamp-2 text-sm leading-relaxed text-base-content/60">{{ post.excerpt }}</p>
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

const heroImage = computed(() => localizedPosts.value.find((post) => post.coverImage)?.coverImage || fallbackBlogImage);
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
.blog-category-btn {
  display: flex;
  min-height: 3rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-radius: 1rem;
  padding: 0.75rem 0.9rem;
  text-align: left;
  font-size: 0.9rem;
  color: color-mix(in oklab, currentColor 75%, transparent);
  transition: transform 180ms ease, background-color 180ms ease, color 180ms ease;
}

.blog-category-btn:hover {
  transform: scale(1.025);
  background: color-mix(in oklab, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
}

.blog-category-btn-active {
  background: var(--color-primary);
  color: var(--color-primary-content);
  box-shadow: 0 10px 24px color-mix(in oklab, var(--color-primary) 24%, transparent);
}

.blog-category-btn-active:hover {
  color: var(--color-primary-content);
}
</style>
