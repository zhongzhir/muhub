import type { ProjectPageView } from "@/lib/demo-project";
import {
  DEFAULT_OG_IMAGE_PATH,
  PROJECT_DESCRIPTION_FALLBACK,
  SITE_NAME_EN,
  SITE_NAME_ZH,
  absoluteUrl,
  resolveOgImageUrl,
} from "@/lib/seo/site";

function firstLine(text: string, maxLen: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) {
    return t;
  }
  return `${t.slice(0, maxLen - 1)}…`;
}

/** 构建项目详情 SEO 描述（优先级：简介 → AI 卡摘要 → tagline → 动态 AI 摘要 → 兜底） */
export function buildProjectMetaDescription(data: ProjectPageView): string {
  const d = data.description?.trim();
  if (d) {
    return firstLine(d, 220);
  }
  const aiCard = data.aiCardSummary?.trim();
  if (aiCard) {
    return firstLine(aiCard, 220);
  }
  const tag = data.tagline?.trim();
  if (tag) {
    return firstLine(tag, 220);
  }
  const weekly = data.aiWeeklySummary?.summary?.trim();
  if (weekly) {
    return firstLine(weekly, 220);
  }
  const aiUpdate = data.updates.find((u) => u.isAiGenerated && u.summary?.trim());
  if (aiUpdate?.summary?.trim()) {
    return firstLine(aiUpdate.summary!.trim(), 220);
  }
  const anySummary = data.updates.find((u) => u.summary?.trim());
  if (anySummary?.summary?.trim()) {
    return firstLine(anySummary.summary!.trim(), 220);
  }
  return PROJECT_DESCRIPTION_FALLBACK;
}

export function buildProjectOgImageUrl(data: ProjectPageView): string {
  if (data.logoUrl?.trim()) {
    return resolveOgImageUrl(data.logoUrl);
  }
  return resolveOgImageUrl(null);
}

/**
 * Open Graph：og:title / og:description / og:url / og:image（绝对 URL）
 * 由 Next metadata 映射到 meta 标签；图片优先 logoUrl，否则站点默认 og-default。
 */
export function buildProjectOpenGraph(data: ProjectPageView, slug: string) {
  const path = `/projects/${slug}`;
  const url = absoluteUrl(path);
  const title = `${data.name} - ${SITE_NAME_ZH} ${SITE_NAME_EN}`;
  const description = buildProjectMetaDescription(data);
  const imgUrl = buildProjectOgImageUrl(data);
  const isDefaultOg = imgUrl === absoluteUrl(DEFAULT_OG_IMAGE_PATH);

  return {
    type: "website" as const,
    locale: "zh_CN",
    url,
    siteName: `${SITE_NAME_ZH} ${SITE_NAME_EN}`,
    title,
    description,
    images: [
      isDefaultOg
        ? { url: imgUrl, width: 1200, height: 630, alt: title }
        : { url: imgUrl, alt: title },
    ],
  };
}

export function buildProjectTwitter(data: ProjectPageView) {
  const title = `${data.name} - ${SITE_NAME_ZH} ${SITE_NAME_EN}`;
  const description = buildProjectMetaDescription(data);
  return {
    card: "summary_large_image" as const,
    title,
    description,
    images: [buildProjectOgImageUrl(data)],
  };
}
