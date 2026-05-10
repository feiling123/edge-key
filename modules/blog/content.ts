export type BlogLocale = "zh" | "en";

export interface BlogCategory {
  id: string;
  name: Record<BlogLocale, string>;
  description: Record<BlogLocale, string>;
}

export interface BlogPost {
  slug: string;
  categoryId: string;
  date: string;
  readMinutes: number;
  coverImage?: string | null;
  title: Record<BlogLocale, string>;
  excerpt: Record<BlogLocale, string>;
  contentHtml: Record<BlogLocale, string>;
}

export const blogCategories: BlogCategory[] = [];
export const blogPosts: BlogPost[] = [];
