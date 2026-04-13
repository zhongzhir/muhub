export type GitHubV3Intent = "active" | "new" | "popular";

export type GitHubV3SchedulerConfig = {
  /**
   * 默认开启 GitHub V3：当前阶段目标是提高自动发现覆盖面。
   * 即使无 token，也允许运行并在日志中提示限流风险。
   */
  enabled: boolean;
  /**
   * intent 顺序即执行顺序，会影响同一关键词下不同搜索意图的优先级。
   * 运营可通过调序快速改变“活跃/新项目/热门项目”的侧重点。
   */
  intents: GitHubV3Intent[];
  /**
   * 单次运行关键词上限，避免一次性请求过多导致限流或运行过载。
   */
  maxKeywordsPerRun: number;
  /**
   * 推荐运行频率标签（仅用于运营与维护说明，不是 cron 表达式）。
   */
  scheduleLabel: "hourly" | "twice_daily" | "daily" | "manual";
  /** 是否启用 Topic 维度发现（通常质量更稳定）。 */
  enableTopicDiscovery: boolean;
  /** 单次运行最多处理多少个 topic，避免请求过载。 */
  maxTopicsPerRun: number;
  /** 是否启用基于已发现项目的 related 扩展。 */
  enableRelatedDiscovery: boolean;
  /** 单次 related 扩展的 seed 上限，防止递归膨胀。 */
  maxRelatedSeeds: number;
  /** GitHub Search 调用间隔，降低触发 rate limit 的概率。 */
  searchDelayMs: number;
};

export type DiscoverySchedulerConfig = {
  enableRss: boolean;
  enableGithubBatch: boolean;
  githubBatchUrls: string[];
  githubV3: GitHubV3SchedulerConfig;
};

export const discoverySchedulerConfig: DiscoverySchedulerConfig = {
  enableRss: true,
  enableGithubBatch: true,
  githubBatchUrls: [
    "https://github.com/openai/openai-cookbook",
    "https://github.com/vercel/next.js",
    "https://github.com/langchain-ai/langchain",
  ],
  githubV3: {
    enabled: true,
    intents: ["active", "new", "popular"],
    maxKeywordsPerRun: 10,
    scheduleLabel: "twice_daily",
    enableTopicDiscovery: true,
    maxTopicsPerRun: 10,
    enableRelatedDiscovery: true,
    maxRelatedSeeds: 5,
    searchDelayMs: 1500,
  },
};
