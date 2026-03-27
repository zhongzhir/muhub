import type { ProjectPageView } from "@/lib/demo-project";
import { buildProjectMetaDescription } from "@/lib/seo/project-meta";
import { SITE_URL } from "@/lib/seo/site";

/** 供项目详情页注入的 SoftwareApplication JSON-LD（无运行时依赖） */
export function buildProjectSoftwareApplicationLd(data: ProjectPageView, slug: string): Record<string, unknown> {
  const url = `${SITE_URL}/projects/${slug}`;
  const description = buildProjectMetaDescription(data);
  const tagPart = data.tags?.length ? data.tags.join(", ") : "";

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: data.name,
    description,
    url,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    creator: {
      "@type": "Organization",
      name: "木哈布 MUHUB",
      url: SITE_URL,
    },
    dateCreated: data.createdAt.toISOString().split("T")[0],
    ...(tagPart ? { keywords: tagPart } : {}),
  };
}
