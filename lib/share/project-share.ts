import type { ProjectPageView } from "@/lib/demo-project";
import { SITE_URL } from "@/lib/seo/site";

const SNIPPET_MAX = 120;
/** 社交文案总长度上限（不含 URL，URL 单独传参） */
const SOCIAL_LINE_MAX = 220;

export function projectCanonicalUrl(slug: string): string {
  return `${SITE_URL}/projects/${slug}`;
}

function truncateFlat(text: string, maxLen: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) {
    return t;
  }
  return `${t.slice(0, maxLen - 1)}…`;
}

/**
 * 传播用一句话：tagline → 正文简介 → AI 卡片摘要 → 兜底
 *（与 SEO description 优先级区分开，更贴近「对外一句话」。）
 */
export function buildProjectShareSnippet(data: ProjectPageView): string {
  if (data.tagline?.trim()) {
    return truncateFlat(data.tagline.trim(), SNIPPET_MAX);
  }
  if (data.description?.trim()) {
    return truncateFlat(data.description.trim(), SNIPPET_MAX);
  }
  if (data.aiCardSummary?.trim()) {
    return truncateFlat(data.aiCardSummary.trim(), SNIPPET_MAX);
  }
  return "在木哈布查看项目主页、动态与仓库信息";
}

/** 「项目名 — 摘要」用于 X 等（不含链接） */
export function buildProjectShareSocialLine(data: ProjectPageView): string {
  const snippet = buildProjectShareSnippet(data);
  const prefix = `${data.name} — `;
  const room = SOCIAL_LINE_MAX - prefix.length;
  const body = snippet.length <= room ? snippet : `${snippet.slice(0, Math.max(0, room - 1))}…`;
  return `${prefix}${body}`;
}

/** 复制到剪贴板：文案 + 正式项目链接 */
export function buildProjectShareClipboardText(data: ProjectPageView, slug: string): string {
  return `${buildProjectShareSocialLine(data)}\n${projectCanonicalUrl(slug)}`;
}
