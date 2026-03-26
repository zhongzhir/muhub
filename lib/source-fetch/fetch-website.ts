/**
 * 最简 HTML 抓取：无 RSS、无 JS 渲染，仅用于首页/文档根 URL 试探。
 */

export type WebsiteUpdateItem = {
  title: string;
  url: string;
  /** 极简版无可靠日期时可为 null */
  publishedAt: Date | null;
};

function decodeBasicEntities(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

/** 从 HTML 抽取 <title>，否则尝试第一个 <h1> */
export function extractPageTitle(html: string): string | null {
  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleM?.[1]) {
    const t = decodeBasicEntities(stripTags(titleM[1])).replace(/\s+/g, " ").trim();
    if (t) return t.slice(0, 500);
  }
  const h1M = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1M?.[1]) {
    const t = decodeBasicEntities(stripTags(h1M[1])).replace(/\s+/g, " ").trim();
    if (t) return t.slice(0, 500);
  }
  return null;
}

/**
 * 拉取页面并生成至多一条「快照」式动态条目（整页视为一条）。
 */
export async function fetchWebsiteUpdates(url: string): Promise<WebsiteUpdateItem[]> {
  const trimmed = url.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const res = await fetch(trimmed, {
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": "MUHUB-SourceFetch/1.0 (project info bot)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });

    const finalUrl = res.url || trimmed;
    if (!res.ok) {
      return [];
    }

    const ct = res.headers.get("content-type") ?? "";
    if (!ct.toLowerCase().includes("text/html") && !ct.toLowerCase().includes("application/xhtml")) {
      return [];
    }

    const html = await res.text();
    const title = extractPageTitle(html);
    if (!title) {
      return [];
    }

    const dateHeader = res.headers.get("last-modified");
    const publishedAt = dateHeader ? new Date(dateHeader) : null;
    const safeDate = publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null;

    return [
      {
        title,
        url: finalUrl,
        publishedAt: safeDate,
      },
    ];
  } catch {
    return [];
  }
}
