import { fetchInstitutionHtml } from "@/lib/discovery/institution/http-fetch";

export function stripHtmlTags(raw: string): string {
  return raw.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function extractHtmlTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m?.[1]) {
    return "";
  }
  return stripHtmlTags(m[1]).slice(0, 300);
}

export function extractHtmlSnippet(html: string, maxLen = 400): string {
  const bodyMatch = html.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i);
  const text = stripHtmlTags(bodyMatch?.[1] ?? html);
  return text.slice(0, maxLen);
}

export function extractHtmlContent(html: string, maxLen = 20_000): string {
  const bodyMatch = html.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i);
  const text = stripHtmlTags(bodyMatch?.[1] ?? html);
  return text.slice(0, maxLen);
}

export type ExtractedLink = {
  href: string;
  text: string;
};

export function extractHtmlLinks(html: string, baseUrl: string): ExtractedLink[] {
  const base = (() => {
    try {
      return new URL(baseUrl);
    } catch {
      return null;
    }
  })();

  const re = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  const out: ExtractedLink[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    const hrefRaw = m[1]?.trim();
    if (!hrefRaw || hrefRaw === "#" || hrefRaw.startsWith("javascript:") || hrefRaw.startsWith("mailto:") || hrefRaw.startsWith("tel:")) {
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
    const norm = absolute.split("#")[0]!;
    if (seen.has(norm)) {
      continue;
    }
    seen.add(norm);
    const text = stripHtmlTags(m[2] ?? "").slice(0, 200);
    out.push({ href: norm, text });
  }

  return out;
}

export async function fetchScanPageHtml(
  url: string,
): Promise<{ ok: true; html: string; fetchedUrl: string } | { ok: false; error: string }> {
  return fetchInstitutionHtml(url);
}

export function matchKeywords(
  haystack: string,
  keywords: string[],
): string[] {
  if (!keywords.length) {
    return [];
  }
  const lower = haystack.toLowerCase();
  const matched: string[] = [];
  for (const kw of keywords) {
    const k = kw.trim();
    if (!k) {
      continue;
    }
    if (lower.includes(k.toLowerCase())) {
      matched.push(k);
    }
  }
  return matched;
}

export function computeScanConfidence(matchedKeywords: string[], depth: number): number {
  let score = 0.45 + Math.min(0.35, matchedKeywords.length * 0.08);
  if (depth === 0) {
    score += 0.05;
  }
  return Math.min(0.92, score);
}
