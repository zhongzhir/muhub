/**
 * 将 App Router 动态段 `[slug]` 与数据库中存的 `Project.slug` 对齐。
 * 少数客户端/测试会对路径二次编码，params 中仍含 %XX 时需再解码一次。
 */
export function normalizeProjectSlugParam(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (!/%[0-9A-Fa-f]{2}/.test(trimmed)) {
    return trimmed;
  }
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}
