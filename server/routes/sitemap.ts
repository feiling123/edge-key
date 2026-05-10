import type { Hono } from "hono";
import type { PrismaClient } from "../../generated/prisma/client";
import { logger } from "../../lib/logger";

export function registerSitemapRoutes(app: Hono) {
  app.get("/sitemap.xml", async (c) => {
    const origin = new URL(c.req.url).origin;

    const staticPages = [
      { loc: `${origin}/`, changefreq: "daily", priority: "1.0" },
      { loc: `${origin}/blog`, changefreq: "weekly", priority: "0.7" },
      { loc: `${origin}/notice`, changefreq: "weekly", priority: "0.6" },
      { loc: `${origin}/about`, changefreq: "monthly", priority: "0.5" },
      { loc: `${origin}/query`, changefreq: "weekly", priority: "0.5" },
    ];

    let productPages: { loc: string; changefreq: string; priority: string }[] = [];
    let blogPages: { loc: string; changefreq: string; priority: string }[] = [];
    try {
      const universalContext = (c as any).get("universalContext") as { prisma: PrismaClient } | undefined;
      const prisma = universalContext?.prisma;
      if (prisma) {
        const [products, posts] = await Promise.all([
          prisma.product.findMany({
            where: { status: "ACTIVE" },
            select: { slug: true },
            orderBy: { sort: "asc" },
          }),
          prisma.blogPost.findMany({
            where: { status: "ACTIVE" },
            select: { slug: true },
            orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
          }),
        ]);
        productPages = products.map((p) => ({
          loc: `${origin}/product/${p.slug}`,
          changefreq: "weekly",
          priority: "0.8",
        }));
        blogPages = posts.map((post) => ({
          loc: `${origin}/blog/${post.slug}`,
          changefreq: "monthly",
          priority: "0.6",
        }));
      }
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), {
        event: "sitemap.dynamic_query_failed",
        source: "sitemap",
      });
    }

    const allPages = [...staticPages, ...blogPages, ...productPages];

    const urlEntries = allPages
      .map(
        (page) => `  <url>
    <loc>${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
      )
      .join("\n");

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

    return c.text(sitemap, 200, {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=86400",
    });
  });
}
