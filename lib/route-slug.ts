/**
 * 将 App Router 动态段 `[slug]` 与数据库中存的 `Project.slug` 对齐。
 * - 少数路径会二次编码（含 %XX）时再解码；
 * - 与创建时 `slugifyProjectName` 一致使用 NFC，避免 NFD/NFC 导致 findUnique 未命中。
 */
export function normalizeProjectSlugParam(raw: string): string {
  let s = raw.trim();
  if (!s) {
    return s;
  }
  if (/%[0-9A-Fa-f]{2}/.test(s)) {
    try {
      s = decodeURIComponent(s);
    } catch {
      /* keep decoded segment as-is */
    }
  }
  return s.normalize("NFC");
}
