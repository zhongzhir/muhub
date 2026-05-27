import { prisma } from "@/lib/prisma";
import { isPublishingDiscoveryPipelineEnabled } from "@/lib/discovery/discovery-feature-flags";
import { projectHasDiscoveryScope } from "@/lib/discovery/discovery-scopes";
import { parseScopesFromConfigJson } from "@/lib/discovery/scope-from-config";
import { runDiscoverySourceByKey } from "@/lib/discovery/run-discovery-source";
import { autoConvertHighConfidencePublishingSignals } from "@/lib/discovery/auto-convert-publishing-signals";

export type PublishingDiscoveryPipelineSummary = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  sourceKeys: string[];
  runs: Array<{
    key: string;
    ok: boolean;
    runId: string;
    fetchedCount: number;
    parsedCount: number;
    newCandidateCount: number;
    updatedCandidateCount: number;
    error?: string;
  }>;
  autoConvert: Awaited<ReturnType<typeof autoConvertHighConfidencePublishingSignals>>;
};

export async function listPublishingDiscoverySourceKeys(): Promise<string[]> {
  const sources = await prisma.discoverySource.findMany({
    where: { status: "ACTIVE" },
    select: { key: true, configJson: true },
    orderBy: { key: "asc" },
  });

  return sources
    .filter((s) => {
      const scopes = parseScopesFromConfigJson(s.configJson);
      return (
        scopes.includes("publishing_ai") ||
        s.key.startsWith("publishing-")
      );
    })
    .map((s) => s.key);
}

export async function runPublishingDiscoveryPipeline(options?: {
  sourceKeys?: string[];
  delayMs?: number;
}): Promise<PublishingDiscoveryPipelineSummary> {
  const startedAt = new Date().toISOString();

  if (!isPublishingDiscoveryPipelineEnabled()) {
    return {
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      sourceKeys: [],
      runs: [],
      autoConvert: { scanned: 0, converted: 0, skipped: 0, errors: [] },
    };
  }

  const keys = options?.sourceKeys?.length
    ? options.sourceKeys
    : await listPublishingDiscoverySourceKeys();

  const runs: PublishingDiscoveryPipelineSummary["runs"] = [];
  const delayMs = Math.max(0, options?.delayMs ?? 500);

  for (const key of keys) {
    const result = await runDiscoverySourceByKey(key);
    runs.push({
      key,
      ok: result.ok,
      runId: result.runId,
      fetchedCount: result.fetchedCount,
      parsedCount: result.parsedCount,
      newCandidateCount: result.newCandidateCount,
      updatedCandidateCount: result.updatedCandidateCount,
      error: result.error,
    });

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const ok = runs.length > 0 && runs.some((r) => r.ok);

  const autoConvert = await autoConvertHighConfidencePublishingSignals({ limit: 40 });
  if (autoConvert.converted > 0) {
    console.log(
      `[publishing-pipeline] auto-converted signals→candidates=${autoConvert.converted}`,
    );
  }

  return {
    ok,
    startedAt,
    finishedAt: new Date().toISOString(),
    sourceKeys: keys,
    runs,
    autoConvert,
  };
}

/** 统计 publishing_ai scope 项目覆盖（用于验收） */
export async function countPublishingAiProjects(): Promise<number> {
  const rows = await prisma.project.findMany({
    where: { deletedAt: null },
    select: { discoveryScopes: true, primaryCategory: true },
  });

  return rows.filter(
    (r) =>
      projectHasDiscoveryScope(r.discoveryScopes, "publishing_ai") ||
      r.primaryCategory === "publishing_media",
  ).length;
}
