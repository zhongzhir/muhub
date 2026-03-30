/**
 * 将 GitHub Search API 条目规范化为候选结构，并做 V1 中国相关启发式（非精准，可后续强化）。
 */

import type { GithubRepoSearchItem } from "@/agents/discovery/github-search";

export type NormalizedDiscoveryCandidate = {
  source: string;
  sourceId: string;
  sourceUrl: string;
  name: string;
  description: string | null;
  ownerName: string;
  repoUrl: string;
  homepageUrl: string | null;
  stars: number;
  primaryLanguage: string | null;
  lastPushedAt: Date | null;
  isChineseRelated: boolean;
  rawPayload: Record<string, unknown>;
};

const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const CHINA_HINT_RE =
  /中国|中文|国内|微信|公众号|哔哩|bilibili|掘金|juejin|Gitee|gitee|\.cn\b|北京|上海|深圳|杭州|腾讯|阿里|字节/i;

/**
 * V1 heuristics：满足任一即标 isChineseRelated；注释便于后续替换为更强规则。
 */
export function inferChineseRelated(item: GithubRepoSearchItem): boolean {
  const desc = item.description ?? "";
  const full = item.full_name ?? "";
  const owner = item.owner?.login ?? "";
  const home = item.homepage ?? "";
  const topics = (item.topics ?? []).join(" ");

  if (CJK_RE.test(desc) || CJK_RE.test(full) || CJK_RE.test(owner)) {
    return true;
  }
  if (CHINA_HINT_RE.test(desc) || CHINA_HINT_RE.test(topics)) {
    return true;
  }
  try {
    if (home && /\.cn(\/|$)/i.test(new URL(home).hostname)) {
      return true;
    }
  } catch {
    if (/\.cn\b/i.test(home)) {
      return true;
    }
  }

  /** 轻量：常见国内拼音公司前缀（可扩） */
  if (/^(tencent|bytedance|alibaba|baidu|deepseek|qwen|modelscope)/i.test(owner)) {
    return true;
  }

  return false;
}

export function normalizeGithubSearchItem(
  item: GithubRepoSearchItem,
  discoverySource: string,
): NormalizedDiscoveryCandidate | null {
  const full = item.full_name?.trim();
  if (!full || !item.html_url) {
    return null;
  }
  const sourceId = full.toLowerCase();
  const ownerName = item.owner?.login?.trim() ?? full.split("/")[0] ?? "unknown";
  const name = item.name?.trim() || full.split("/")[1] || full;

  let lastPushedAt: Date | null = null;
  if (item.pushed_at) {
    const d = new Date(item.pushed_at);
    lastPushedAt = Number.isNaN(d.getTime()) ? null : d;
  }

  const rawPayload: Record<string, unknown> = {
    githubId: item.id,
    full_name: full,
    topics: (item.topics ?? []).slice(0, 12),
  };

  return {
    source: discoverySource,
    sourceId,
    sourceUrl: item.html_url,
    name,
    description: item.description?.trim() ? item.description.trim() : null,
    ownerName,
    repoUrl: item.html_url,
    homepageUrl: item.homepage?.trim() ? item.homepage.trim() : null,
    stars: typeof item.stargazers_count === "number" ? item.stargazers_count : 0,
    primaryLanguage: item.language ?? null,
    lastPushedAt,
    isChineseRelated: inferChineseRelated(item),
    rawPayload,
  };
}
