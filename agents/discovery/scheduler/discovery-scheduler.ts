import { runGitHubBatchDiscovery } from "../github/github-discovery";
import { runRssDiscovery } from "../rss/rss-discovery";
import {
  discoverySchedulerConfig,
  type DiscoverySchedulerConfig,
} from "./discovery-scheduler-config";

type JobStatus = "success" | "failed" | "skipped";

export type DiscoveryScheduledSummary = {
  startedAt: string;
  finishedAt: string;
  rss: JobStatus;
  githubBatch: JobStatus;
};

let running = false;

export async function runDiscoveryScheduledJob(
  config: DiscoverySchedulerConfig = discoverySchedulerConfig,
): Promise<DiscoveryScheduledSummary> {
  const startedAt = new Date().toISOString();
  if (running) {
    console.warn("[DiscoveryScheduler] another run is already in progress");
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      rss: "skipped",
      githubBatch: "skipped",
    };
  }

  running = true;
  let rss: JobStatus = "skipped";
  let githubBatch: JobStatus = "skipped";

  try {
    console.log(`[DiscoveryScheduler] started at ${startedAt}`);

    if (config.enableRss) {
      try {
        await runRssDiscovery();
        rss = "success";
        console.log("[DiscoveryScheduler] source rss: success");
      } catch (e) {
        rss = "failed";
        console.error("[DiscoveryScheduler] source rss: failed", e);
      }
    } else {
      console.log("[DiscoveryScheduler] source rss: skipped");
    }

    if (config.enableGithubBatch) {
      try {
        const result = await runGitHubBatchDiscovery(config.githubBatchUrls);
        githubBatch = "success";
        console.log(
          `[DiscoveryScheduler] source github-batch: success (total=${result.total}, inserted=${result.inserted}, skipped=${result.skipped}, invalid=${result.invalid})`,
        );
      } catch (e) {
        githubBatch = "failed";
        console.error("[DiscoveryScheduler] source github-batch: failed", e);
      }
    } else {
      console.log("[DiscoveryScheduler] source github-batch: skipped");
    }

    const finishedAt = new Date().toISOString();
    console.log(
      `[DiscoveryScheduler] finished at ${finishedAt} (rss=${rss}, githubBatch=${githubBatch})`,
    );
    return { startedAt, finishedAt, rss, githubBatch };
  } finally {
    running = false;
  }
}
