export type DiscoverySchedulerConfig = {
  enableRss: boolean;
  enableGithubBatch: boolean;
  enableGithubV3: boolean;
  githubBatchUrls: string[];
};

export const discoverySchedulerConfig: DiscoverySchedulerConfig = {
  enableRss: true,
  enableGithubBatch: true,
  enableGithubV3: false,
  githubBatchUrls: [
    "https://github.com/openai/openai-cookbook",
    "https://github.com/vercel/next.js",
    "https://github.com/langchain-ai/langchain",
  ],
};
