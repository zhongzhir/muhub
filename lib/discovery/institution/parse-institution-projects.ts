import type { InstitutionSourceConfig } from "@/lib/discovery/institution/institution-source";

export type ParsedInstitutionProject = {
  name: string;
  description?: string;
  url: string;
};

const SKIP_HOST_SUBSTR = [
  "facebook.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "instagram.com",
  "youtube.com",
  "mailto:",
  "tel:",
  "javascript:",
];

function shouldSkipHref(absolute: string): boolean {
  const lower = absolute.toLowerCase();
  if (lower.endsWith(".pdf") || lower.endsWith(".zip")) {
    return true;
  }
  return SKIP_HOST_SUBSTR.some((s) => lower.includes(s));
}

function stripTags(raw: string): string {
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * 启发式解析机构项目列表页 HTML：提取带可读标题的外链条目（相对 URL 会按 listUrl 解析）
 */
export function parseInstitutionProjects(html: string, listUrl: string): ParsedInstitutionProject[] {
  const base = (() => {
    try {
      return new URL(listUrl);
    } catch {
      return null;
    }
  })();

  const re =
    /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  const out: ParsedInstitutionProject[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const hrefRaw = m[1]?.trim();
    if (!hrefRaw || hrefRaw === "#") {
      continue;
    }
    let absolute: string;
    try {
      absolute = base ? new URL(hrefRaw, base).href : new URL(hrefRaw).href;
    } catch {
      continue;
    }
    if (!/^https?:\/\//i.test(absolute)) {
      continue;
    }
    if (shouldSkipHref(absolute)) {
      continue;
    }
    const name = stripTags(m[2] ?? "");
    if (name.length < 2 || name.length > 200) {
      continue;
    }
    const norm = absolute.split("#")[0]!;
    if (seen.has(norm)) {
      continue;
    }
    seen.add(norm);
    out.push({ name, url: norm });
    if (out.length >= 200) {
      break;
    }
  }
  return out;
}

/** 从 configJson 解析 listUrl（InstitutionSourceConfig.url） */
export function listUrlFromInstitutionConfig(
  config: InstitutionSourceConfig | null | undefined,
  fallbackDiscoverySourceUrl?: string | null,
): string | null {
  const u = config?.url?.trim() || fallbackDiscoverySourceUrl?.trim();
  return u || null;
}
