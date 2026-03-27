import type { MetadataRoute } from "next";
import { fetchPublicProjectSlugsForSitemap } from "@/lib/project-list";
import { SITE_URL } from "@/lib/seo/site";

/**
 * 基础 sitemap：主路由 + 项目广场 + 库内公开项目详情。
 * 后续若增加更多公开落地页，在此扩展即可。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/projects`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const rows = await fetchPublicProjectSlugsForSitemap();
  const projectEntries: MetadataRoute.Sitemap = rows.map((p) => ({
    url: `${SITE_URL}/projects/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticEntries, ...projectEntries];
}
