import { runDailyDiscoveryWorkflow } from "@/lib/discovery/daily-discovery-workflow";

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") {
    return fallback;
  }
  return !["0", "false", "no"].includes(value.trim().toLowerCase());
}

async function main() {
  const candidateLimit = Number(process.env.DAILY_DISCOVERY_CANDIDATE_LIMIT ?? "20");
  const summary = await runDailyDiscoveryWorkflow({
    candidateLimit: Number.isFinite(candidateLimit) ? candidateLimit : 20,
    runSources: boolFromEnv(process.env.DAILY_DISCOVERY_SOURCES, true),
    runEnrichment: boolFromEnv(process.env.DAILY_DISCOVERY_ENRICHMENT, true),
    runClassification: boolFromEnv(process.env.DAILY_DISCOVERY_CLASSIFICATION, true),
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("[daily-discovery] failed", error);
  process.exitCode = 1;
});
