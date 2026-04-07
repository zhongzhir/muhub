import { runDiscoveryScheduledJob } from "../agents/discovery/scheduler/discovery-scheduler";

async function main(): Promise<void> {
  const summary = await runDiscoveryScheduledJob();
  console.log("[DiscoveryScheduler] summary");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
