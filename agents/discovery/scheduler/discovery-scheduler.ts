import { runGitHubBatchDiscovery } from "../github/github-discovery";
import { runGitHubDiscoveryV3 } from "../github/github-discovery-v3";
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
  githubV3: JobStatus;
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
      githubV3: "skipped",
    };
  }

  running = true;
  let rss: JobStatus = "skipped";
  let githubBatch: JobStatus = "skipped";
  let githubV3: JobStatus = "skipped";

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

    if (config.enableGithubV3) {
      try {
        const result = await runGitHubDiscoveryV3();
        githubV3 = "success";
        console.log(
          `[DiscoveryScheduler] source github-v3: success (keywords=${result.keywordsProcessed}, inserted=${result.inserted}, skipped=${result.skipped}, invalid=${result.invalid}, failedKeywords=${result.failedKeywords.length})`,
        );
      } catch (e) {
        githubV3 = "failed";
        console.error("[DiscoveryScheduler] source github-v3: failed", e);
      }
    } else {
      console.log("[DiscoveryScheduler] source github-v3: skipped");
    }

    const finishedAt = new Date().toISOString();
    console.log(
      `[DiscoveryScheduler] finished at ${finishedAt} (rss=${rss}, githubBatch=${githubBatch}, githubV3=${githubV3})`,
    );
    return { startedAt, finishedAt, rss, githubBatch, githubV3 };
  } finally {
    running = false;
  }
}
