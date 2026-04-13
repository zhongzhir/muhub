import { runGitHubDiscoveryV3 } from "../agents/discovery/github/github-discovery-v3";
import { discoverySchedulerConfig } from "../agents/discovery/scheduler/discovery-scheduler-config";

async function main(): Promise<void> {
  const summary = await runGitHubDiscoveryV3({
    intents: discoverySchedulerConfig.githubV3.intents,
    maxKeywordsPerRun: discoverySchedulerConfig.githubV3.maxKeywordsPerRun,
  });
  console.log("[GitHub Discovery V3] summary");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
