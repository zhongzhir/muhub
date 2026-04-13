import { runGitHubDiscoveryV3 } from "../agents/discovery/github/github-discovery-v3";

async function main(): Promise<void> {
  const summary = await runGitHubDiscoveryV3();
  console.log("[GitHub Discovery V3] summary");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
