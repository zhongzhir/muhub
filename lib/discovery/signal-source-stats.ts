import { normalizeReferenceSources } from "@/lib/discovery/reference-sources";

export type DiscoverySignalSourceStats = {
  total: number;
  newsCount: number;
  blogCount: number;
  socialCount: number;
  summaryText: string;
  isMultiSource: boolean;
};

export function getDiscoverySignalSourceStats(referenceSources: unknown): DiscoverySignalSourceStats {
  const refs = normalizeReferenceSources(referenceSources);
  let newsCount = 0;
  let blogCount = 0;
  let socialCount = 0;
  for (const item of refs) {
    if (item.type === "NEWS") {
      newsCount += 1;
    } else if (item.type === "BLOG") {
      blogCount += 1;
    } else if (item.type === "SOCIAL") {
      socialCount += 1;
    }
  }
  const total = refs.length;
  const parts: string[] = [];
  if (newsCount > 0) {
    parts.push(`${newsCount} 个媒体报道`);
  }
  if (blogCount > 0) {
    parts.push(`${blogCount} 篇博客`);
  }
  if (socialCount > 0) {
    parts.push(`${socialCount} 条社媒`);
  }
  return {
    total,
    newsCount,
    blogCount,
    socialCount,
    summaryText: parts.join(" + ") || "暂无多来源信息",
    isMultiSource: total >= 2,
  };
}
