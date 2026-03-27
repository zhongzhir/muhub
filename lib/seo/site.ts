/** 全站 SEO / OG 基准（生产域名） */
export const SITE_URL = "https://www.muhub.cn";

export const SITE_NAME_ZH = "木哈布";
export const SITE_NAME_EN = "MUHUB";

export const DEFAULT_TITLE =
  "木哈布 MUHUB - AI Native 项目展示与动态聚合平台";

export const DEFAULT_DESCRIPTION =
  "木哈布 MUHUB 是 AI Native 项目展示与动态聚合平台，帮助创业项目展示进展、聚合公开信息、吸引投资与合作。";

export const OG_TITLE = DEFAULT_TITLE;

export const OG_DESCRIPTION =
  "把仓库、官网和动态收进一页，让合作方、投资人与用户快速理解项目在做什么、最近有什么进展。";

export const KEYWORDS: string[] = [
  "MUHUB",
  "木哈布",
  "AI Native",
  "项目展示",
  "创业项目",
  "项目动态",
  "GitHub 项目",
  "创投",
  "项目融资",
  "项目主页",
];

/** 项目详情页 description 无数据时的兜底 */
export const PROJECT_DESCRIPTION_FALLBACK =
  "在木哈布 MUHUB 查看项目介绍、公开动态、仓库信息与最新进展。";

/** 默认分享图（相对站点根路径） */
export const DEFAULT_OG_IMAGE_PATH = "/og-default.png";

export function absoluteUrl(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(path, SITE_URL).toString();
}

/** 创建项目表单展示用：项目页路径前缀（如 www.muhub.cn/projects/） */
export function projectPublicPathPrefix(): string {
  try {
    const u = new URL(SITE_URL);
    return `${u.host}/projects/`;
  } catch {
    return "www.muhub.cn/projects/";
  }
}

export function resolveOgImageUrl(image: string | null | undefined): string {
  if (!image?.trim()) {
    return absoluteUrl(DEFAULT_OG_IMAGE_PATH);
  }
  const s = image.trim();
  if (s.startsWith("http://") || s.startsWith("https://")) {
    return s;
  }
  if (s.startsWith("/")) {
    return absoluteUrl(s);
  }
  return absoluteUrl(`/${s}`);
}
