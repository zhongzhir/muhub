import type { InstitutionParsedItem } from "@/lib/discovery/institution/types";

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

type ParseHtmlLinksOptions = {
  /** 写入每条 metadata，便于区分 parser 场景 */
  entryKind?: string;
  maxItems?: number;
};

/** 从 HTML 提取外链条目（相对 URL 按 listUrl 解析） */
export function parseHtmlLinkItems(
  html: string,
  listUrl: string,
  options?: ParseHtmlLinksOptions,
): InstitutionParsedItem[] {
  const maxItems = options?.maxItems ?? 200;
  const base = (() => {
    try {
      return new URL(listUrl);
    } catch {
      return null;
    }
  })();

  const re = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  const out: InstitutionParsedItem[] = [];
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
    const title = stripTags(m[2] ?? "");
    if (title.length < 2 || title.length > 200) {
      continue;
    }
    const norm = absolute.split("#")[0]!;
    if (seen.has(norm)) {
      continue;
    }
    seen.add(norm);
    out.push({
      title,
      summary: undefined,
      website: norm,
      externalUrl: norm,
      metadata: options?.entryKind ? { entryKind: options.entryKind } : undefined,
    });
    if (out.length >= maxItems) {
      break;
    }
  }
  return out;
}
