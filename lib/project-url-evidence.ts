import { fetchTextWithRetry } from "@/lib/fetch-with-retry";

export type WebsiteEvidenceSnapshot = {
  url: string;
  finalUrl: string | null;
  reachable: boolean;
  statusCode: number | null;
  errorMessage: string | null;
  title: string | null;
  description: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  headings: string[];
  textExcerpt: string | null;
  checkedAt: string;
};

const DEFAULT_TIMEOUT_MS = 12_000;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

function metaContent(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = match?.[1]?.trim();
    if (value) {
      return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
    }
  }
  return null;
}

function extractHeadings(html: string, limit = 6): string[] {
  const headings: string[] = [];
  const seen = new Set<string>();
  const pattern = /<(h1|h2)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const text = decodeHtmlEntities(match[2] ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || text.length < 2 || text.length > 120) {
      continue;
    }
    const key = text.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    headings.push(text);
    if (headings.length >= limit) {
      break;
    }
  }
  return headings;
}

function extractTextExcerpt(html: string, max = 1200): string | null {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const source = bodyMatch?.[1] ?? html;
  const text = decodeHtmlEntities(source)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) {
    return null;
  }
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function extractWebsiteEvidenceFromHtml(
  html: string,
  input: { url: string; finalUrl?: string | null; statusCode?: number | null },
): WebsiteEvidenceSnapshot {
  const title = metaContent(html, [/<title[^>]*>([\s\S]*?)<\/title>/i]) ?? null;
  const description =
    metaContent(html, [
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    ]) ?? null;
  const ogTitle =
    metaContent(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    ]) ?? null;
  const ogDescription =
    metaContent(html, [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
    ]) ?? null;
  const headings = extractHeadings(html);
  const textExcerpt = extractTextExcerpt(html);
  const hasSignals = Boolean(
    title || description || ogTitle || ogDescription || headings.length || textExcerpt,
  );

  return {
    url: input.url,
    finalUrl: input.finalUrl ?? input.url,
    reachable: hasSignals || (input.statusCode != null && input.statusCode >= 200 && input.statusCode < 400),
    statusCode: input.statusCode ?? null,
    errorMessage: null,
    title: title ? title.slice(0, 200) : null,
    description: description ? description.slice(0, 400) : null,
    ogTitle: ogTitle ? ogTitle.slice(0, 200) : null,
    ogDescription: ogDescription ? ogDescription.slice(0, 400) : null,
    headings,
    textExcerpt,
    checkedAt: new Date().toISOString(),
  };
}

export function isFetchableProjectWebsiteUrl(url: string | null | undefined): url is string {
  if (!url?.trim()) {
    return false;
  }
  const lower = url.trim().toLowerCase();
  if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
    return false;
  }
  if (lower.includes("raw.githubusercontent.com")) {
    return false;
  }
  if (
    lower.includes("github.com/") &&
    (lower.includes("/blob/") || lower.includes("/tree/") || lower.endsWith(".md"))
  ) {
    return false;
  }
  return true;
}

export function collectProjectWebsiteFetchUrls(input: {
  websiteUrl?: string | null;
  officialWebsite?: string | null;
  sources?: Array<{ kind: string; url?: string | null; label?: string | null }>;
}): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string | null | undefined) => {
    if (!isFetchableProjectWebsiteUrl(raw)) {
      return;
    }
    const key = raw.trim().toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    urls.push(raw.trim());
  };
  add(input.websiteUrl ?? null);
  add(input.officialWebsite ?? null);
  for (const source of input.sources ?? []) {
    if (source.kind !== "WEBSITE") {
      continue;
    }
    if (source.label?.toLowerCase().includes("curated_repository")) {
      continue;
    }
    add(source.url ?? null);
  }
  return urls;
}

async function fetchWebsiteEvidenceOnce(
  rawUrl: string,
  options?: { timeoutMs?: number },
): Promise<WebsiteEvidenceSnapshot> {
  const url = rawUrl.trim();
  const checkedAt = new Date().toISOString();
  if (!url.startsWith("http")) {
    return {
      url,
      finalUrl: null,
      reachable: false,
      statusCode: null,
      errorMessage: "invalid_url",
      title: null,
      description: null,
      ogTitle: null,
      ogDescription: null,
      headings: [],
      textExcerpt: null,
      checkedAt,
    };
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const resp = await fetchTextWithRetry(url, {
    timeoutMs,
    retries: 1,
    allowedContentTypes: ["text/html", "application/xhtml", "text/plain"],
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });
  const finalUrl = resp.finalUrl || url;
  if (!resp.ok) {
    return {
      url,
      finalUrl,
      reachable: false,
      statusCode: resp.status || null,
      errorMessage: resp.error ?? `HTTP ${resp.status}`,
      title: null,
      description: null,
      ogTitle: null,
      ogDescription: null,
      headings: [],
      textExcerpt: null,
      checkedAt,
    };
  }
  if (!resp.text) {
    return {
      url,
      finalUrl,
      reachable: true,
      statusCode: resp.status,
      errorMessage: null,
      title: null,
      description: null,
      ogTitle: null,
      ogDescription: null,
      headings: [],
      textExcerpt: null,
      checkedAt,
    };
  }
  return extractWebsiteEvidenceFromHtml(resp.text, {
    url,
    finalUrl,
    statusCode: resp.status,
  });
}

function shouldRetryWebsiteFetch(snapshot: WebsiteEvidenceSnapshot): boolean {
  if (snapshot.reachable) {
    return false;
  }
  const message = (snapshot.errorMessage ?? "").toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("aborted") ||
    message.includes("fetch failed") ||
    message.includes("network")
  );
}

export async function fetchWebsiteEvidence(
  rawUrl: string,
  options?: { timeoutMs?: number },
): Promise<WebsiteEvidenceSnapshot> {
  const first = await fetchWebsiteEvidenceOnce(rawUrl, options);
  if (!shouldRetryWebsiteFetch(first)) {
    return first;
  }
  return fetchWebsiteEvidenceOnce(rawUrl, options);
}

export async function fetchWebsiteEvidenceBatch(
  urls: string[],
  options?: { timeoutMs?: number; limit?: number },
): Promise<WebsiteEvidenceSnapshot[]> {
  const unique = Array.from(new Set(urls.map((item) => item.trim()).filter(Boolean)));
  const limit = options?.limit ?? 3;
  const targets = unique.slice(0, limit);
  const out: WebsiteEvidenceSnapshot[] = [];
  for (const url of targets) {
    out.push(await fetchWebsiteEvidence(url, options));
  }
  return out;
}

export function formatWebsiteEvidenceForPrompt(items: WebsiteEvidenceSnapshot[]): string {
  if (!items.length) {
    return "- 未执行官网抓取";
  }
  return items
    .map((item, index) => {
      const lines = [
        `- 官网证据 ${index + 1}`,
        `  url: ${item.url}`,
        item.finalUrl && item.finalUrl !== item.url ? `  finalUrl: ${item.finalUrl}` : null,
        `  reachable: ${item.reachable}`,
        item.statusCode != null ? `  statusCode: ${item.statusCode}` : null,
        item.errorMessage ? `  errorMessage: ${item.errorMessage}` : null,
        item.title ? `  title: ${item.title}` : null,
        item.description ? `  description: ${item.description}` : null,
        item.ogTitle ? `  ogTitle: ${item.ogTitle}` : null,
        item.ogDescription ? `  ogDescription: ${item.ogDescription}` : null,
        item.headings.length ? `  headings: ${item.headings.join(" | ")}` : null,
        item.textExcerpt ? `  textExcerpt: ${item.textExcerpt.slice(0, 800)}` : null,
        `  checkedAt: ${item.checkedAt}`,
      ];
      return lines.filter(Boolean).join("\n");
    })
    .join("\n");
}

export function bestTitleFromWebsiteEvidence(item: WebsiteEvidenceSnapshot | null | undefined): string | null {
  if (!item) {
    return null;
  }
  return item.ogTitle || item.title || null;
}

export function bestDescriptionFromWebsiteEvidence(item: WebsiteEvidenceSnapshot | null | undefined): string | null {
  if (!item) {
    return null;
  }
  return item.ogDescription || item.description || item.textExcerpt || null;
}
