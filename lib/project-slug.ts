/**
 * 由项目名称生成「项目访问地址」路径段（支持中文；英文小写 + 空白转短横线）。
 */
export function slugifyProjectName(raw: string): string {
  let s = raw.trim().normalize("NFC");
  if (!s) {
    return "";
  }
  s = s.replace(/[A-Z]/g, (c) => c.toLowerCase());
  s = s.replace(/\s+/g, "-");
  s = s.replace(/[^\u4e00-\u9fff\u3400-\u4dbfa-z0-9-]/g, "");
  s = s.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (s.length > 120) {
    s = s.slice(0, 120).replace(/-+$/g, "");
  }
  return s;
}

/**
 * 允许：CJK（基本区 + 扩展 A）、英文小写、数字、中段短横线；禁止首尾短横线、连续横线已由 slugify 收敛。
 */
export function isValidProjectSlug(slug: string): boolean {
  if (!slug || slug.length > 160) {
    return false;
  }
  if (slug.startsWith("-") || slug.endsWith("-") || slug.includes("--")) {
    return false;
  }
  return /^[\u4e00-\u9fff\u3400-\u4dbfa-z0-9]+(-[\u4e00-\u9fff\u3400-\u4dbfa-z0-9]+)*$/.test(slug);
}

/** 无法从名称得到有效 slug 时的兜底前缀 */
export function fallbackSlugBase(): string {
  return `project-${Date.now().toString(36)}`;
}
