export type ReferenceSourceCategory = "NEWS" | "SOCIAL" | "BLOG";

export type ReferenceSourceItem = {
  type: ReferenceSourceCategory;
  url: string;
  title?: string | null;
  summary?: string | null;
  sourceName?: string | null;
  note?: string | null;
  source?: string | null;
  isPrimary?: boolean;
};

function normalizeType(raw: unknown): ReferenceSourceCategory | null {
  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim().toUpperCase();
  if (value === "NEWS" || value === "SOCIAL" || value === "BLOG") {
    return value;
  }
  return null;
}

function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim();
  if (!value) {
    return null;
  }
  try {
    return new URL(value).href;
  } catch {
    return null;
  }
}

function inferTypeFromUrl(url: string): ReferenceSourceCategory {
  const host = new URL(url).hostname.toLowerCase();
  if (
    host.includes("x.com") ||
    host.includes("twitter.com") ||
    host.includes("weibo.com") ||
    host.includes("zhihu.com") ||
    host.includes("douyin.com") ||
    host.includes("xiaohongshu.com")
  ) {
    return "SOCIAL";
  }
  if (
    host.includes("medium.com") ||
    host.includes("substack.com") ||
    host.includes("hashnode.com") ||
    host.includes("dev.to")
  ) {
    return "BLOG";
  }
  return "NEWS";
}

export function normalizeReferenceSources(raw: unknown): ReferenceSourceItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: ReferenceSourceItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const obj = item as Record<string, unknown>;
    const url = normalizeUrl(obj.url);
    if (!url) {
      continue;
    }
    const type = normalizeType(obj.type) ?? inferTypeFromUrl(url);
    out.push({
      type,
      url,
      title: typeof obj.title === "string" ? obj.title.trim() || null : null,
      summary: typeof obj.summary === "string" ? obj.summary.trim() || null : null,
      sourceName: typeof obj.sourceName === "string" ? obj.sourceName.trim() || null : null,
      note: typeof obj.note === "string" ? obj.note.trim() || null : null,
      source: typeof obj.source === "string" ? obj.source.trim() || null : null,
      isPrimary: Boolean(obj.isPrimary),
    });
  }
  return ensureSinglePrimary(dedupeReferenceSources(out));
}

export function dedupeReferenceSources(items: ReferenceSourceItem[]): ReferenceSourceItem[] {
  const seen = new Set<string>();
  const out: ReferenceSourceItem[] = [];
  for (const item of items) {
    const key = `${item.type}:${item.url.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function ensureSinglePrimary(items: ReferenceSourceItem[]): ReferenceSourceItem[] {
  let hasPrimary = false;
  return items.map((item) => {
    if (item.isPrimary && !hasPrimary) {
      hasPrimary = true;
      return { ...item, isPrimary: true };
    }
    return { ...item, isPrimary: false };
  });
}

export function mergeReferenceSources(
  baseRaw: unknown,
  incomingRaw: unknown,
): ReferenceSourceItem[] {
  const merged = [...normalizeReferenceSources(baseRaw), ...normalizeReferenceSources(incomingRaw)];
  return ensureSinglePrimary(dedupeReferenceSources(merged));
}

export function inferReferenceSourcesFromCandidate(input: {
  externalUrl?: string | null;
  website?: string | null;
  repoUrl?: string | null;
  docsUrl?: string | null;
  twitterUrl?: string | null;
  sourceName?: string | null;
}): ReferenceSourceItem[] {
  const rows: ReferenceSourceItem[] = [];
  const pushUrl = (type: ReferenceSourceCategory, url: string | null | undefined, title: string) => {
    if (!url?.trim()) {
      return;
    }
    const normalized = normalizeUrl(url);
    if (!normalized) {
      return;
    }
    rows.push({
      type,
      url: normalized,
      title,
      source: input.sourceName ?? null,
    });
  };
  pushUrl("NEWS", input.externalUrl, "来源页面");
  pushUrl("NEWS", input.website, "官网");
  pushUrl("BLOG", input.docsUrl, "文档/博客");
  pushUrl("SOCIAL", input.twitterUrl, "社媒");
  pushUrl("NEWS", input.repoUrl, "代码仓库");
  return dedupeReferenceSources(rows);
}
