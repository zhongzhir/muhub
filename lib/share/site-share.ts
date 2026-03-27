import { DEFAULT_TITLE, OG_DESCRIPTION, SITE_URL } from "@/lib/seo/site";

/** 首页正式 URL（含尾部斜杠与不带斜杠视部署而定；统一不加斜杠路径） */
export function homeCanonicalUrl(): string {
  return SITE_URL.endsWith("/") ? SITE_URL.slice(0, -1) : SITE_URL;
}

/** 首页复制用：标题调 + 简介调 + 链接 */
export function buildHomeShareClipboardText(): string {
  return `${DEFAULT_TITLE}\n${OG_DESCRIPTION}\n${homeCanonicalUrl()}`;
}

/** X 用短文案（不含链接） */
export function buildHomeShareSocialLine(): string {
  return `${DEFAULT_TITLE} — ${OG_DESCRIPTION}`;
}
