import { getContext } from "telefunc";
import { pinyin } from "pinyin-pro";
import type { PrismaClient } from "../../generated/prisma/client";
import { badRequestError, conflictError, notFoundError } from "../../lib/app-error";
import { extractFirstImageSrc, plainTextFromHtml } from "../../lib/utils/html";
import { getAdminContext, logAdminOperation } from "../auth/service";
import type { BlogCategory, BlogPost } from "./content";

export interface AdminBlogCategory {
  id: number;
  slug: string;
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  descriptionEn: string;
  sort: number;
}

export interface AdminBlogPost {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  slug: string;
  titleZh: string;
  titleEn: string;
  excerptZh: string;
  excerptEn: string;
  contentZh: string;
  contentEn: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE";
  readMinutes: number;
  publishedAt: string;
  createdAt: string;
}

function getBlogContext() {
  return getContext<{ prisma: PrismaClient }>();
}

export async function getPublicBlogIndex(prisma?: PrismaClient): Promise<{ categories: BlogCategory[]; posts: BlogPost[] }> {
  const client = prisma ?? getBlogContext().prisma;

  const [categories, posts] = await Promise.all([
    client.blogCategory.findMany({
      orderBy: [{ sort: "asc" }, { id: "asc" }],
    }),
    client.blogPost.findMany({
      where: { status: "ACTIVE" },
      include: { category: true },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    }),
  ]);

  return {
    categories: categories.map((item): BlogCategory => ({
      id: String(item.id),
      name: { zh: item.nameZh, en: item.nameEn },
      description: { zh: item.descriptionZh ?? "", en: item.descriptionEn ?? "" },
    })),
    posts: posts.map(mapPublicPost),
  };
}

export async function getPublicBlogDetail(slug: string, prisma?: PrismaClient) {
  const index = await getPublicBlogIndex(prisma);
  const post = index.posts.find((item) => item.slug === slug) ?? null;
  return {
    post,
    categories: index.categories,
    related: post ? index.posts.filter((item) => item.categoryId === post.categoryId && item.slug !== post.slug).slice(0, 3) : [],
  };
}

export async function getAdminBlogData(prisma?: PrismaClient) {
  const client = prisma ?? getBlogContext().prisma;
  const [categories, posts] = await Promise.all([
    client.blogCategory.findMany({
      orderBy: [{ sort: "asc" }, { id: "asc" }],
    }),
    client.blogPost.findMany({
      include: { category: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    }),
  ]);

  return {
    categories: categories.map(mapAdminCategory),
    posts: posts.map(mapAdminPost),
  };
}

export async function saveBlogCategory(input: {
  id?: number;
  slug?: string;
  nameZh: string;
  nameEn?: string;
  descriptionZh?: string;
  descriptionEn?: string;
  sort?: number;
}) {
  const adminContext = getAdminContext();
  const { prisma } = adminContext;
  const adminId = Number(adminContext.session?.user?.id);
  const nameZh = input.nameZh.trim();
  const nameEn = input.nameEn?.trim() || nameZh;

  if (!nameZh) {
    throw badRequestError("博客分类名称不能为空", "BLOG_CATEGORY_NAME_REQUIRED");
  }

  const slug = slugify(input.slug?.trim() || nameEn || nameZh);
  if (!slug) {
    throw badRequestError("博客分类 slug 不能为空", "BLOG_CATEGORY_SLUG_REQUIRED");
  }

  try {
    const record = input.id
      ? await prisma.blogCategory.update({
          where: { id: input.id },
          data: {
            slug,
            nameZh,
            nameEn,
            descriptionZh: input.descriptionZh?.trim() || null,
            descriptionEn: input.descriptionEn?.trim() || null,
            sort: Number.isFinite(input.sort) ? Math.floor(input.sort ?? 0) : 0,
          },
        })
      : await prisma.blogCategory.create({
          data: {
            slug,
            nameZh,
            nameEn,
            descriptionZh: input.descriptionZh?.trim() || null,
            descriptionEn: input.descriptionEn?.trim() || null,
            sort: Number.isFinite(input.sort) ? Math.floor(input.sort ?? 0) : 0,
          },
        });

    await logAdminOperation(
      {
        action: input.id ? "UPDATE_BLOG_CATEGORY" : "CREATE_BLOG_CATEGORY",
        targetType: "BlogCategory",
        targetId: String(record.id),
        detail: `slug=${record.slug}`,
      },
      { prisma, adminId },
    );

    return mapAdminCategory(record);
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw conflictError("博客分类 Slug 已存在，请换一个", "BLOG_CATEGORY_SLUG_CONFLICT");
    }
    throw error;
  }
}

export async function deleteBlogCategory(input: { id: number }) {
  const adminContext = getAdminContext();
  const { prisma } = adminContext;
  const adminId = Number(adminContext.session?.user?.id);
  const record = await prisma.blogCategory.findUnique({ where: { id: input.id } });
  if (!record) {
    throw notFoundError("博客分类不存在", "BLOG_CATEGORY_NOT_FOUND");
  }

  await prisma.blogCategory.delete({ where: { id: input.id } });
  await logAdminOperation(
    {
      action: "DELETE_BLOG_CATEGORY",
      targetType: "BlogCategory",
      targetId: String(record.id),
      detail: `slug=${record.slug}`,
    },
    { prisma, adminId },
  );

  return { id: input.id };
}

export async function saveBlogPost(input: {
  id?: number;
  categoryId?: number | null;
  slug?: string;
  titleZh: string;
  titleEn?: string;
  excerptZh?: string;
  excerptEn?: string;
  contentZh: string;
  contentEn?: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE";
  readMinutes?: number;
  publishedAt?: string;
}) {
  const adminContext = getAdminContext();
  const { prisma } = adminContext;
  const adminId = Number(adminContext.session?.user?.id);
  const titleZh = input.titleZh.trim();
  const titleEn = input.titleEn?.trim() || titleZh;
  const contentZh = input.contentZh.trim();
  const contentEn = input.contentEn?.trim() || contentZh;

  if (!titleZh) {
    throw badRequestError("博客标题不能为空", "BLOG_TITLE_REQUIRED");
  }
  if (!contentZh) {
    throw badRequestError("博客内容不能为空", "BLOG_CONTENT_REQUIRED");
  }

  const slug = slugify(input.slug?.trim() || titleEn || titleZh);
  if (!slug) {
    throw badRequestError("博客 slug 不能为空", "BLOG_SLUG_REQUIRED");
  }

  const status = ["DRAFT", "ACTIVE", "INACTIVE"].includes(input.status) ? input.status : "DRAFT";
  const readMinutes = Number.isFinite(input.readMinutes) ? Math.min(60, Math.max(1, Math.floor(input.readMinutes ?? 3))) : 3;
  const publishedAt = parseDate(input.publishedAt) ?? new Date();

  try {
    const record = input.id
      ? await prisma.blogPost.update({
          where: { id: input.id },
          include: { category: true },
          data: {
            categoryId: input.categoryId ?? null,
            slug,
            titleZh,
            titleEn,
            excerptZh: input.excerptZh?.trim() || null,
            excerptEn: input.excerptEn?.trim() || null,
            contentZh,
            contentEn,
            status,
            readMinutes,
            publishedAt,
          },
        })
      : await prisma.blogPost.create({
          include: { category: true },
          data: {
            categoryId: input.categoryId ?? null,
            slug,
            titleZh,
            titleEn,
            excerptZh: input.excerptZh?.trim() || null,
            excerptEn: input.excerptEn?.trim() || null,
            contentZh,
            contentEn,
            status,
            readMinutes,
            publishedAt,
          },
        });

    await logAdminOperation(
      {
        action: input.id ? "UPDATE_BLOG_POST" : "CREATE_BLOG_POST",
        targetType: "BlogPost",
        targetId: String(record.id),
        detail: `slug=${record.slug}`,
      },
      { prisma, adminId },
    );

    return mapAdminPost(record);
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw conflictError("博客文章 Slug 已存在，请换一个", "BLOG_SLUG_CONFLICT");
    }
    throw error;
  }
}

export async function deleteBlogPost(input: { id: number }) {
  const adminContext = getAdminContext();
  const { prisma } = adminContext;
  const adminId = Number(adminContext.session?.user?.id);
  const record = await prisma.blogPost.findUnique({ where: { id: input.id } });
  if (!record) {
    throw notFoundError("博客文章不存在", "BLOG_POST_NOT_FOUND");
  }

  await prisma.blogPost.delete({ where: { id: input.id } });
  await logAdminOperation(
    {
      action: "DELETE_BLOG_POST",
      targetType: "BlogPost",
      targetId: String(record.id),
      detail: `slug=${record.slug}`,
    },
    { prisma, adminId },
  );

  return { id: input.id };
}

function mapAdminCategory(item: any): AdminBlogCategory {
  return {
    id: item.id,
    slug: item.slug,
    nameZh: item.nameZh,
    nameEn: item.nameEn,
    descriptionZh: item.descriptionZh ?? "",
    descriptionEn: item.descriptionEn ?? "",
    sort: item.sort,
  };
}

function mapAdminPost(item: any): AdminBlogPost {
  return {
    id: item.id,
    categoryId: item.categoryId ?? null,
    categoryName: item.category?.nameZh ?? null,
    slug: item.slug,
    titleZh: item.titleZh,
    titleEn: item.titleEn,
    excerptZh: item.excerptZh ?? "",
    excerptEn: item.excerptEn ?? "",
    contentZh: item.contentZh,
    contentEn: item.contentEn,
    status: item.status,
    readMinutes: item.readMinutes,
    publishedAt: toDateInput(item.publishedAt ?? item.createdAt),
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt),
  };
}

function mapPublicPost(item: any): BlogPost {
  const excerptZh = item.excerptZh?.trim() || plainTextFromHtml(item.contentZh).slice(0, 120);
  const excerptEn = item.excerptEn?.trim() || plainTextFromHtml(item.contentEn).slice(0, 140) || excerptZh;

  return {
    slug: item.slug,
    categoryId: item.categoryId ? String(item.categoryId) : "",
    date: toDateInput(item.publishedAt ?? item.createdAt),
    readMinutes: item.readMinutes,
    coverImage: extractFirstImageSrc(item.contentZh) || extractFirstImageSrc(item.contentEn) || null,
    title: { zh: item.titleZh, en: item.titleEn },
    excerpt: { zh: excerptZh, en: excerptEn },
    contentHtml: { zh: item.contentZh, en: item.contentEn },
  };
}

function slugify(input: string) {
  const pinyinStr = pinyin(input, { toneType: "none", nonZh: "consecutive" });
  return pinyinStr
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateInput(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}
