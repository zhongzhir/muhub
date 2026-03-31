/**
 * 自动发现 V1：多条简单 GitHub 搜索任务（每请求一条短 query），脚本层去重。
 * 中国相关仅在后处理 normalize / 启发式中标注，不写入搜索 q。
 */

import { buildGitHubSearchQuery } from "@/agents/discovery/github-search-query";

/** 单个搜索任务：与 {@link fetchGithubSearchRepositories} 一次调用对应。 */
export type GithubDiscoverySearchTask = {
  source: string;
  query: string;
  sort: "updated" | "stars";
  perPage: number;
};

const KEYWORDS = ["ai", "agent", "llm", "mcp"] as const;
const LANGUAGES = ["TypeScript", "Python"] as const;

/** 主发现：更新时间排序，关键词 × 语言 */
const V1_PUSHED = "2024-01-01";
const V1_MIN_STARS = 20;

/** Trending 风格：只提高 stars + pushed 门槛，sort=stars，无 topic / 括号 */
const TREND_PUSHED = "2024-06-01";
const TREND_MIN_STARS = 80;
const TREND_KEYWORDS = ["ai", "llm", "agent"] as const;

const primaryTasks: GithubDiscoverySearchTask[] = KEYWORDS.flatMap((keyword) =>
  LANGUAGES.map((language) => ({
    source: "github-search",
    sort: "updated" as const,
    perPage: 20,
    query: buildGitHubSearchQuery({
      keyword,
      language,
      minStars: V1_MIN_STARS,
      pushedAfter: V1_PUSHED,
    }),
  })),
);

const trendingStyleTasks: GithubDiscoverySearchTask[] = TREND_KEYWORDS.map(
  (keyword) => ({
    source: "github-trending-style",
    sort: "stars" as const,
    perPage: 15,
    query: buildGitHubSearchQuery({
      keyword,
      minStars: TREND_MIN_STARS,
      pushedAfter: TREND_PUSHED,
    }),
  }),
);

export const GITHUB_DISCOVERY_SEARCH_TASKS: GithubDiscoverySearchTask[] = [
  ...primaryTasks,
  ...trendingStyleTasks,
];
