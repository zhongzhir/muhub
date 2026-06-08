export type DiscoverySourceLinkLevel =
  | "primary_candidate"
  | "secondary_evidence"
  | "referrer"
  | "inferred";

export type ClassifiedDiscoverySourceLink = {
  url: string;
  host: string;
  sourceLevel: DiscoverySourceLinkLevel;
  sourceKind:
    | "github"
    | "huggingface"
    | "gitcc"
    | "gitee"
    | "arxiv"
    | "doi"
    | "official_docs"
    | "official_site"
    | "wechat"
    | "media"
    | "unknown";
};

const MEDIA_HOST_HINTS = [
  "news",
  "medium.com",
  "substack.com",
  "36kr.com",
  "jiqizhixin.com",
  "qbitai.com",
  "publishingperspectives.com",
];

function hostOf(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function classifyDiscoverySourceUrl(
  rawUrl: string | null | undefined,
): ClassifiedDiscoverySourceLink | null {
  if (!rawUrl?.trim()) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  const host = hostOf(url.href);
  if (!host) {
    return null;
  }
  const path = url.pathname.toLowerCase();

  if (host === "github.com") {
    return { url: url.href, host, sourceKind: "github", sourceLevel: "primary_candidate" };
  }
  if (host === "huggingface.co") {
    return { url: url.href, host, sourceKind: "huggingface", sourceLevel: "primary_candidate" };
  }
  if (host.includes("gitcode") || host.includes("gitcc")) {
    return { url: url.href, host, sourceKind: "gitcc", sourceLevel: "primary_candidate" };
  }
  if (host === "gitee.com") {
    return { url: url.href, host, sourceKind: "gitee", sourceLevel: "primary_candidate" };
  }
  if (host === "arxiv.org") {
    return { url: url.href, host, sourceKind: "arxiv", sourceLevel: "primary_candidate" };
  }
  if (host === "doi.org" || path.includes("/doi/")) {
    return { url: url.href, host, sourceKind: "doi", sourceLevel: "primary_candidate" };
  }
  if (path.includes("/docs") || path.includes("/documentation") || host.startsWith("docs.")) {
    return {
      url: url.href,
      host,
      sourceKind: "official_docs",
      sourceLevel: "primary_candidate",
    };
  }
  if (host.includes("mp.weixin.qq.com")) {
    return { url: url.href, host, sourceKind: "wechat", sourceLevel: "secondary_evidence" };
  }
  if (MEDIA_HOST_HINTS.some((hint) => host.includes(hint))) {
    return { url: url.href, host, sourceKind: "media", sourceLevel: "secondary_evidence" };
  }

  return { url: url.href, host, sourceKind: "official_site", sourceLevel: "primary_candidate" };
}

export function classifyDiscoverySourceUrls(urls: string[]): ClassifiedDiscoverySourceLink[] {
  const seen = new Set<string>();
  const out: ClassifiedDiscoverySourceLink[] = [];
  for (const rawUrl of urls) {
    const classified = classifyDiscoverySourceUrl(rawUrl);
    if (!classified || seen.has(classified.url)) {
      continue;
    }
    seen.add(classified.url);
    out.push(classified);
  }
  return out;
}
