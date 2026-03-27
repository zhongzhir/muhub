import type { Page } from "@playwright/test";

/** 将 pathname 转为与 UI/数据库 slug 一致的解码形式（浏览器对非 ASCII 常为 %XX 编码）；NFC 与 `slugifyProjectName` / `normalizeProjectSlugParam` 一致。 */
function normalizedDetailPathname(pathname: string): string {
  const p = pathname.replace(/\/$/, "");
  try {
    return decodeURIComponent(p).normalize("NFC");
  } catch {
    return p.normalize("NFC");
  }
}

/**
 * 创建项目表单提交后，等待进入项目详情页并解析真实访问路径 slug。
 * 与生产侧 allocateUniqueSlug 一致：可能为 slugify(名称) 或带 -2/-3 后缀，不能用 raw 名称拼 URL。
 */
export async function waitForProjectSlugAfterCreate(page: Page): Promise<string> {
  await page.waitForURL(
    (url) => {
      const p = url.pathname.replace(/\/$/, "");
      if (!/^\/projects\/[^/]+$/.test(p)) {
        return false;
      }
      const seg = p.slice("/projects/".length);
      if (seg === "new" || seg === "import") {
        return false;
      }
      return true;
    },
    { timeout: 60_000 },
  );
  const p = new URL(page.url()).pathname.replace(/\/$/, "");
  const parts = p.split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "projects") {
    throw new Error(`Unexpected path after create: ${p}`);
  }
  try {
    return decodeURIComponent(parts[1]!).normalize("NFC");
  } catch {
    return parts[1]!.normalize("NFC");
  }
}

/** 等待停留在指定 slug 的项目详情页（slug 为解码后的 Unicode，与 url 比较时统一 decode pathname） */
export async function waitForProjectDetailUrl(page: Page, slug: string): Promise<void> {
  const expectPath = `/projects/${slug.normalize("NFC")}`;
  await page.waitForURL(
    (url) => normalizedDetailPathname(url.pathname) === expectPath,
    { timeout: 60_000 },
  );
}
