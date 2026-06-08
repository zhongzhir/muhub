import Parser from "rss-parser";
import {
  extractHtmlContent,
  extractHtmlLinks,
  fetchScanPageHtml,
} from "@/lib/discovery/website-scan/html-utils";
import {
  classifyDiscoverySourceUrls,
  type ClassifiedDiscoverySourceLink,
} from "@/lib/discovery/source-link-classifier";

export type RssFeedItem = {
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  rawText: string | null;
  rawTextLength: number;
  fullTextStatus: "rss_summary" | "fetched_page" | "fetch_failed";
  fullTextSource: "rss_summary" | "fetched_page";
  fullTextError: string | null;
  sourceLinks: ClassifiedDiscoverySourceLink[];
};

export type FetchRssFeedOptions = {
  url: string;
  maxItems?: number;
  timeoutMs?: number;
};

const parser = new Parser({
  timeout: 15_000,
  headers: {
    "User-Agent": "MUHUB-Discovery/2.0 (+https://muhub.cn)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

function safeText(input: string | undefined | null): string {
  return (input ?? "").trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveRssItemFullText(
  url: string,
  snippet: string | null,
): Promise<{
  rawText: string | null;
  rawTextLength: number;
  fullTextStatus: RssFeedItem["fullTextStatus"];
  fullTextSource: RssFeedItem["fullTextSource"];
  fullTextError: string | null;
  sourceLinks: ClassifiedDiscoverySourceLink[];
}> {
  const summary = snippet?.trim() || null;
  const summaryLength = summary?.length ?? 0;
  if (summaryLength >= 2_000) {
    return {
      rawText: summary,
      rawTextLength: summaryLength,
      fullTextStatus: "rss_summary",
      fullTextSource: "rss_summary",
      fullTextError: null,
      sourceLinks: classifyDiscoverySourceUrls([url]),
    };
  }

  const fetched = await fetchScanPageHtml(url);
  if (!fetched.ok) {
    return {
      rawText: summary,
      rawTextLength: summaryLength,
      fullTextStatus: "fetch_failed",
      fullTextSource: "rss_summary",
      fullTextError: fetched.error,
      sourceLinks: classifyDiscoverySourceUrls([url]),
    };
  }

  const fullText = extractHtmlContent(fetched.html, 30_000);
  const htmlLinks = extractHtmlLinks(fetched.html, fetched.fetchedUrl).map((link) => link.href);
  const sourceLinks = classifyDiscoverySourceUrls([fetched.fetchedUrl, ...htmlLinks]);
  if (fullText.length <= summaryLength) {
    return {
      rawText: summary,
      rawTextLength: summaryLength,
      fullTextStatus: "rss_summary",
      fullTextSource: "rss_summary",
      fullTextError: null,
      sourceLinks,
    };
  }

  return {
    rawText: fullText,
    rawTextLength: fullText.length,
    fullTextStatus: "fetched_page",
    fullTextSource: "fetched_page",
    fullTextError: null,
    sourceLinks,
  };
}

export async function fetchRssFeedItems(
  options: FetchRssFeedOptions,
): Promise<{ ok: true; items: RssFeedItem[] } | { ok: false; error: string }> {
  const url = options.url.trim();
  if (!url) {
    return { ok: false, error: "RSS url is empty" };
  }

  const maxItems = Math.min(50, Math.max(1, options.maxItems ?? 15));

  try {
    const feed = await parser.parseURL(url);
    const items: RssFeedItem[] = [];

    for (const item of feed.items.slice(0, maxItems)) {
      const title = safeText(item.title);
      const link = safeText(item.link || item.guid);
      if (!title || !link) {
        continue;
      }

      const snippet =
        safeText(item.contentSnippet) ||
        safeText(item.summary) ||
        stripHtml(safeText(item.content)).slice(0, 500) ||
        null;

      const fullText = await resolveRssItemFullText(link, snippet);

      items.push({
        title,
        url: link,
        summary: snippet,
        publishedAt: item.isoDate ?? item.pubDate ?? null,
        rawText: fullText.rawText,
        rawTextLength: fullText.rawTextLength,
        fullTextStatus: fullText.fullTextStatus,
        fullTextSource: fullText.fullTextSource,
        fullTextError: fullText.fullTextError,
        sourceLinks: fullText.sourceLinks,
      });
    }

    return { ok: true, items };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message.slice(0, 500) };
  }
}
