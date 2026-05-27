import Parser from "rss-parser";

export type RssFeedItem = {
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  rawText: string | null;
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

      items.push({
        title,
        url: link,
        summary: snippet,
        publishedAt: item.isoDate ?? item.pubDate ?? null,
        rawText: snippet,
      });
    }

    return { ok: true, items };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message.slice(0, 500) };
  }
}
