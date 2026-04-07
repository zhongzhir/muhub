/**
 * Discovery V2 基础版：向本地 JSON 队列写入一条 GitHub 仓库示例（不调用 GitHub API）。
 *
 * 运行：pnpm discovery:items-demo
 */

import { createDiscoveryItem } from "../agents/discovery/discovery-agent";

const DEMO_REPO_URL = "https://github.com/openai/openai-cookbook";

function parseGithubRepoLabel(url: string): string {
  try {
    const u = new URL(url.trim());
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
  } catch {
    // ignore
  }
  return "github-repo";
}

async function run(): Promise<void> {
  const title = parseGithubRepoLabel(DEMO_REPO_URL);
  const item = await createDiscoveryItem({
    sourceType: "github",
    title,
    url: DEMO_REPO_URL,
    description: `Demo：GitHub 仓库「${title}」。由 scripts/run-discovery-github-demo.ts 写入，未抓取 stars/API。`,
  });

  console.log("[run-discovery-github-demo] Discovery item ready:");
  console.log(JSON.stringify(item, null, 2));
  console.log("\nSee data/discovery-items.json");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
