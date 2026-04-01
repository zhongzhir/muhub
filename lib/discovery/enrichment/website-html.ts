import type { EnrichmentPlatform } from "@/lib/discovery/enrichment/classify-platform";
import { classifyEnrichmentPlatform } from "@/lib/discovery/enrichment/classify-platform";
import {
  hostFromNormalizedUrl,
  normalizeEnrichmentUrl,
} from "@/lib/discovery/enrichment/url-utils";
import type { EnrichmentExtract } from "@/lib/discovery/enrichment/github-repo-homepage";

const MAX_HTML = 400_000;

function extractHrefUrls(html: string): { url: string; index: number }[] {
  const out: { url: string; index: number }[] = [];
  const re = /href\s*=\s*["'](https?:\/\/[^"'>\s]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push({ url: m[1], index: m.index });
  }
  return out;
}

function regionConfidence(index: number, len: number): number {
  if (len <= 0) {
    return 0.6;
  }
  const topEnd = Math.floor(len * 0.15);
  const botStart = Math.floor(len * 0.85);
  if (index <= topEnd) {
    return 0.85;
  }
  if (index >= botStart) {
    return 0.85;
  }
  return 0.6;
}

/** 仅抓取官网首页 HTML，从 header/footer 区域（首尾 15% 字符）启发式抽 href。 */
export async function enrichFromWebsiteHomepage(
  websiteUrl: string,
  logs: string[],
): Promise<EnrichmentExtract[]> {
  const entry = normalizeEnrichmentUrl(websiteUrl);
  if (!entry) {
    logs.push("[website] invalid url");
    return [];
  }

  let res: Response;
  try {
    res = await fetch(entry, {
      headers: { "User-Agent": "MUHUB-Enrichment/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(22_000),
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logs.push(`[website] fetch error ${msg}`);
    return [];
  }

  if (!res.ok) {
    logs.push(`[website] HTTP ${res.status}`);
    return [];
  }
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("text/html")) {
    logs.push("[website] not html");
    return [];
  }

  let html = await res.text();
  if (html.length > MAX_HTML) {
    html = html.slice(0, MAX_HTML);
    logs.push("[website] truncated html");
  }

  const baseHost = hostFromNormalizedUrl(entry);
  const hrefs = extractHrefUrls(html);
  const seen = new Set<string>();
  const out: EnrichmentExtract[] = [];
  const len = html.length;

  for (const { url: raw, index } of hrefs) {
    const norm = normalizeEnrichmentUrl(raw);
    if (!norm || seen.has(norm)) {
      continue;
    }
    const host = hostFromNormalizedUrl(norm);
    const plat = classifyEnrichmentPlatform(norm) as EnrichmentPlatform | null;
    if (!plat) {
      continue;
    }
    if (host === baseHost && (plat === "website" || plat === "blog")) {
      continue;
    }
    seen.add(norm);
    const conf = regionConfidence(index, len);
    out.push({
      url: norm,
      platform: plat,
      source: "website-html",
      confidence: conf,
      evidenceText: `href@${index}`,
    });
  }

  logs.push(`[website] extracted ${out.length} external-ish links`);
  return out;
}
