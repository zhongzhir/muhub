export type EnrichmentPlatform =
  | "docs"
  | "twitter"
  | "discord"
  | "blog"
  | "youtube"
  | "telegram"
  | "website";

/**
 * 基于域名与路径的平台识别（统一入口）。
 */
export function classifyEnrichmentPlatform(rawUrl: string): EnrichmentPlatform | null {
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return null;
  }

  const h = u.hostname.toLowerCase();
  const p = u.pathname.toLowerCase();

  if (h === "youtu.be" || h === "youtube.com" || h.endsWith(".youtube.com")) {
    return "youtube";
  }
  if (h === "t.me" || h === "telegram.me" || h === "telegram.org") {
    return "telegram";
  }
  if (h === "discord.gg" || h === "discord.com" || h.endsWith(".discord.com")) {
    return "discord";
  }
  if (
    h === "twitter.com" ||
    h === "x.com" ||
    h === "mobile.twitter.com" ||
    h.endsWith(".x.com")
  ) {
    return "twitter";
  }
  if (
    h === "medium.com" ||
    h === "substack.com" ||
    h.endsWith(".substack.com") ||
    h === "dev.to"
  ) {
    return "blog";
  }
  if (h.startsWith("blog.") || p === "/blog" || p.startsWith("/blog/")) {
    return "blog";
  }

  if (
    h.startsWith("docs.") ||
    h.includes(".readthedocs.io") ||
    h.includes("readme.io") ||
    h === "readthedocs.io" ||
    h.endsWith(".gitbook.io") ||
    h.endsWith(".gitbook.com")
  ) {
    return "docs";
  }
  if (
    p.startsWith("/docs") ||
    p.startsWith("/documentation") ||
    p.includes("/doc/") ||
    h.includes("documentation.")
  ) {
    return "docs";
  }

  return "website";
}
