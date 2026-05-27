/**
 * Source Network：来源类型与 configJson 约定（轻量，非 CMS）。
 */

export const SOURCE_KINDS = [
  "RSS",
  "GITHUB_TOPIC",
  "WEBSITE",
  "WECHAT",
  "OTHER",
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];

export const SOURCE_OWNERS = ["system", "manual", "expert"] as const;

export type SourceOwner = (typeof SOURCE_OWNERS)[number];

export function parseSourceKind(configJson: unknown): SourceKind {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return "OTHER";
  }
  const cfg = configJson as Record<string, unknown>;
  const raw = typeof cfg.sourceKind === "string" ? cfg.sourceKind.trim().toUpperCase() : "";
  if (raw === "RSS" || cfg.mode === "rss") {
    return "RSS";
  }
  if (raw === "GITHUB_TOPIC" || cfg.mode === "github_topic") {
    return "GITHUB_TOPIC";
  }
  if (raw === "WEBSITE" || cfg.mode === "website_list") {
    return "WEBSITE";
  }
  if (raw === "WECHAT") {
    return "WECHAT";
  }
  return "OTHER";
}

export function parseSourceOwner(configJson: unknown): SourceOwner {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return "system";
  }
  const raw = (configJson as Record<string, unknown>).sourceOwner;
  if (typeof raw === "string" && (SOURCE_OWNERS as readonly string[]).includes(raw)) {
    return raw as SourceOwner;
  }
  return "system";
}

export function sourceUrlFromConfig(configJson: unknown): string | null {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return null;
  }
  const url = (configJson as Record<string, unknown>).url;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

export function slugifySourceKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
