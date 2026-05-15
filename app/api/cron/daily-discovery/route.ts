import { verifyCronAuth, cronResponse } from "@/lib/cron/cron-auth";
import { runDailyDiscoveryWorkflow } from "@/lib/discovery/daily-discovery-workflow";

/**
 * Cron: daily discovery workflow.
 *
 * This prepares the review queue only: source discovery, candidate enrichment,
 * classification, and priority refresh. It does not auto-publish projects.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const candidateLimit = Number(url.searchParams.get("candidateLimit") ?? "20");
  const runSources = url.searchParams.get("sources") !== "0";
  const runEnrichment = url.searchParams.get("enrichment") !== "0";
  const runClassification = url.searchParams.get("classification") !== "0";

  console.log("[cron/daily-discovery] start", {
    candidateLimit,
    runSources,
    runEnrichment,
    runClassification,
  });

  try {
    const summary = await runDailyDiscoveryWorkflow({
      candidateLimit: Number.isFinite(candidateLimit) ? candidateLimit : 20,
      runSources,
      runEnrichment,
      runClassification,
    });
    console.log("[cron/daily-discovery] done", summary);
    return cronResponse({
      job: "daily-discovery",
      ...summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/daily-discovery] failed:", message);
    return cronResponse({ job: "daily-discovery", error: message }, 500);
  }
}
