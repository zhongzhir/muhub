/**
 * Phase 1+2 验收统计（一次性脚本）
 * pnpm tsx scripts/acceptance-publishing-discovery-stats.ts
 */
import { PrismaClient } from "@prisma/client";
import { parseScopesFromConfigJson } from "../lib/discovery/scope-from-config";
import { projectHasDiscoveryScope } from "../lib/discovery/discovery-scopes";

const prisma = new PrismaClient();

async function countPublishingAiProjects(): Promise<number> {
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

async function main(): Promise<void> {
  const projects = await prisma.project.findMany({
    where: { deletedAt: null },
    select: { id: true, discoveryScopes: true, primaryCategory: true, visibilityStatus: true },
  });

  const publishingAiProjects = projects.filter((p) =>
    projectHasDiscoveryScope(p.discoveryScopes, "publishing_ai"),
  );
  const publishingMediaOnly = projects.filter(
    (p) =>
      p.primaryCategory === "publishing_media" &&
      !projectHasDiscoveryScope(p.discoveryScopes, "publishing_ai"),
  );
  const backfillOk =
    publishingMediaOnly.length === 0 &&
    projects
      .filter((p) => p.primaryCategory === "publishing_media")
      .every((p) => projectHasDiscoveryScope(p.discoveryScopes, "publishing_ai"));

  const sources = await prisma.discoverySource.findMany({
    select: { key: true, status: true, type: true, configJson: true },
  });
  const publishingSources = sources.filter((s) => {
    const scopes = parseScopesFromConfigJson(s.configJson);
    return scopes.includes("publishing_ai") || s.key.startsWith("publishing-");
  });
  const publishingSourcesActive = publishingSources.filter((s) => s.status === "ACTIVE");

  const publishingSourceIds = publishingSources.map((s) =>
    prisma.discoverySource.findUnique({ where: { key: s.key }, select: { id: true } }),
  );
  const sourceIdRows = await Promise.all(publishingSourceIds);
  const sourceIds = sourceIdRows.map((r) => r?.id).filter(Boolean) as string[];

  const signalsTotal = await prisma.discoverySignal.count({
    where: sourceIds.length ? { sourceId: { in: sourceIds } } : { id: "impossible" },
  });

  const candidatesTotal = await prisma.discoveryCandidate.count({
    where: sourceIds.length ? { sourceId: { in: sourceIds } } : { id: "impossible" },
  });

  const importable = await prisma.discoveryCandidate.count({
    where: {
      ...(sourceIds.length ? { sourceId: { in: sourceIds } } : { id: "impossible" }),
      reviewStatus: "PENDING",
      importStatus: "PENDING",
    },
  });

  const recentRuns = await prisma.discoveryRun.findMany({
    where: sourceIds.length ? { sourceId: { in: sourceIds } } : { id: "impossible" },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: { source: { select: { key: true } } },
  });

  const failedRuns = recentRuns.filter((r) => r.status === "FAILED" || r.status === "PARTIAL");

  console.log(JSON.stringify({
    projects: {
      total: projects.length,
      publishingAiScope: publishingAiProjects.length,
      publishingMediaCategory: projects.filter((p) => p.primaryCategory === "publishing_media").length,
      publishingMediaMissingScope: publishingMediaOnly.length,
      backfillSuccess: backfillOk,
      publishedPublishingAi: publishingAiProjects.filter((p) => p.visibilityStatus === "PUBLISHED").length,
    },
    sources: {
      publishingTotal: publishingSources.length,
      publishingActive: publishingSourcesActive.length,
      keys: publishingSources.map((s) => ({ key: s.key, status: s.status, type: s.type })),
    },
    signals: { publishingRelatedTotal: signalsTotal },
    candidates: {
      publishingRelatedTotal: candidatesTotal,
      importablePending: importable,
    },
    recentRuns: recentRuns.map((r) => ({
      key: r.source.key,
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      fetched: r.fetchedCount,
      parsed: r.parsedCount,
      newCandidates: r.newCandidateCount,
      error: r.errorMessage?.slice(0, 120) ?? null,
    })),
    failedOrPartialRuns: failedRuns.length,
  }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
