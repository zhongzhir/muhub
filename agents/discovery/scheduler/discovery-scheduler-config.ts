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
    maxKeywordsPerRun: 20,
    scheduleLabel: "twice_daily",
  },
};
