/**
 * 自动发现 V1：可调的 GitHub 搜索策略（非后台配置，改常量即可）。
 * 后续可接 Gitee / 手工来源表等，与 {@link GITHUB_DISCOVERY_SEARCH_QUERIES} 并列扩展。
 */

/** 单个搜索任务：同一 query 可对应不同 source 标签（如 trending 风格） */
export type GithubDiscoverySearchTask = {
  /** 写入 DiscoveredProjectCandidate.source */
  source: string;
  /** GitHub `q` 查询串 */
  query: string;
  /** 列表排序 */
  sort: "updated" | "stars";
  /** 每页条数（最大 100，V1 用小批量） */
  perPage: number;
};

/**
 * V1 固定策略：关键词 + 语言 + 更新时间，兼顾「活跃」与「trending 风格」高星。
 * 中国优先由 normalize 阶段启发式标注，不在此限流国家。
 */
export const GITHUB_DISCOVERY_SEARCH_TASKS: GithubDiscoverySearchTask[] = [
  {
    source: "github-search",
    sort: "updated",
    perPage: 20,
    query:
      "(ai OR agent OR llm OR copilot OR workflow OR mcp) (language:TypeScript OR language:Python OR language:Go) stars:>=20 pushed:>=2024-01-01",
  },
  {
    source: "github-trending-style",
    sort: "stars",
    perPage: 15,
    query: "(topic:ai OR topic:llm OR topic:machine-learning) stars:100..5000 pushed:>2024-09-01",
  },
];
