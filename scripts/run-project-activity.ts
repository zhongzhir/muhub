import { runGitHubProjectActivity } from "../agents/activity/github-activity";

async function main(): Promise<void> {
  const summary = await runGitHubProjectActivity();
  console.log("[Project Activity] GitHub run summary");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
