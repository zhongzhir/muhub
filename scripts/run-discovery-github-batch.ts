import { runGitHubBatchDiscovery } from "../agents/discovery/github/github-discovery";

const DEMO_URLS = [
  "https://github.com/openai/openai-cookbook",
  "https://github.com/vercel/next.js/tree/canary",
  "https://github.com/langchain-ai/langchain",
  "https://github.com/openai/openai-cookbook", // duplicate
  "https://example.com/not-github", // invalid
];

async function main(): Promise<void> {
  const result = await runGitHubBatchDiscovery(DEMO_URLS);
  console.log(
    `[GitHub Discovery] total=${result.total} inserted=${result.inserted} skipped=${result.skipped} invalid=${result.invalid}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
