/** Phase 1+2 验收深度分析 */
import { PrismaClient } from "@prisma/client";
import { parseScopesFromConfigJson } from "../lib/discovery/scope-from-config";
import { projectHasDiscoveryScope } from "../lib/discovery/discovery-scopes";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const sources = await prisma.discoverySource.findMany({
    select: { id: true, key: true, status: true, type: true, configJson: true, lastErrorMessage: true },
  });
  const pubSources = sources.filter((s) => {
    const scopes = parseScopesFromConfigJson(s.configJson);
    return scopes.includes("publishing_ai") || s.key.startsWith("publishing-");
  });
  const pubIds = pubSources.map((s) => s.id);

  const projects = await prisma.project.findMany({
    where: { deletedAt: null },
    select: { slug: true, discoveryScopes: true, primaryCategory: true, visibilityStatus: true },
  });
  const publishingAi = projects.filter((p) => projectHasDiscoveryScope(p.discoveryScopes, "publishing_ai"));

  const signals = await prisma.discoverySignal.findMany({
    where: { sourceId: { in: pubIds } },
    select: {
      id: true,
      title: true,
      url: true,
      status: true,
      source: { select: { key: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const candidates = await prisma.discoveryCandidate.findMany({
    where: { sourceId: { in: pubIds } },
    select: {
      id: true,
      title: true,
      repoUrl: true,
      reviewStatus: true,
      importStatus: true,
      source: { select: { key: true } },
      normalizedKey: true,
      dedupeHash: true,
      metadataJson: true,
    },
    orderBy: { firstSeenAt: "desc" },
    take: 10,
  });

  const importable = await prisma.discoveryCandidate.count({
    where: {
      sourceId: { in: pubIds },
      reviewStatus: "PENDING",
      importStatus: "PENDING",
    },
  });

  const runs = await prisma.discoveryRun.findMany({
    where: { sourceId: { in: pubIds } },
    orderBy: { startedAt: "desc" },
    include: { source: { select: { key: true } } },
  });

  const runSummary = runs.map((r) => ({
    key: r.source.key,
    status: r.status,
    fetched: r.fetchedCount,
    parsed: r.parsedCount,
    newCand: r.newCandidateCount,
    error: r.errorMessage?.slice(0, 100) ?? null,
  }));

  // Duplicate normalizedKey among publishing candidates
  const allPubCands = await prisma.discoveryCandidate.findMany({
    where: { sourceId: { in: pubIds } },
    select: { normalizedKey: true, dedupeHash: true, title: true, repoUrl: true },
  });
  const keyCounts = new Map<string, number>();
  for (const c of allPubCands) {
    const k = c.normalizedKey ?? c.dedupeHash ?? c.repoUrl ?? c.title;
    keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1);
  }
  const dupKeys = [...keyCounts.entries()].filter(([, n]) => n > 1);

  // Cross-source duplicate with existing projects (github url match)
  const pubWithRepo = allPubCands.filter((c) => c.repoUrl);
  const existingGithub = await prisma.project.findMany({
    where: { githubUrl: { not: null }, deletedAt: null },
    select: { githubUrl: true, slug: true },
  });
  const existingSet = new Set(existingGithub.map((p) => p.githubUrl?.toLowerCase()));
  const overlapExisting = pubWithRepo.filter((c) =>
    existingSet.has(c.repoUrl?.toLowerCase() ?? ""),
  );

  const rssFails = runSummary.filter(
    (r) =>
      r.key.includes("publishing-") &&
      !r.key.includes("github") &&
      (r.status === "FAILED" || r.parsed === 0),
  );

  const signalBySource = await prisma.discoverySignal.groupBy({
    by: ["sourceId"],
    where: { sourceId: { in: pubIds } },
    _count: { id: true },
  });
  const sourceKeyMap = new Map(pubSources.map((s) => [s.id, s.key]));
  const signalsPerSource = signalBySource.map((g) => ({
    key: sourceKeyMap.get(g.sourceId),
    count: g._count.id,
  }));

  const candBySource = await prisma.discoveryCandidate.groupBy({
    by: ["sourceId"],
    where: { sourceId: { in: pubIds } },
    _count: { id: true },
  });
  const candsPerSource = candBySource.map((g) => ({
    key: sourceKeyMap.get(g.sourceId),
    count: g._count.id,
  }));

  console.log(
    JSON.stringify(
      {
        q1_publishingAiProjects: publishingAi.length,
        q1_published: publishingAi.filter((p) => p.visibilityStatus === "PUBLISHED").length,
        q2_publishingSourcesTotal: pubSources.length,
        q2_publishingSourcesActive: pubSources.filter((s) => s.status === "ACTIVE").length,
        q3_signalsTotal: signals.length > 0 ? await prisma.discoverySignal.count({ where: { sourceId: { in: pubIds } } }) : 0,
        q4_candidatesTotal: allPubCands.length,
        q5_importablePending: importable,
        q6_backfill: {
          publishingMedia: projects.filter((p) => p.primaryCategory === "publishing_media").length,
          missingScope: projects.filter(
            (p) => p.primaryCategory === "publishing_media" && !projectHasDiscoveryScope(p.discoveryScopes, "publishing_ai"),
          ).length,
        },
        q7_issues: {
          rssFailures: rssFails,
          duplicateNormalizedKeys: dupKeys.length,
          duplicateExamples: dupKeys.slice(0, 5),
          candidatesOverlappingExistingProjects: overlapExisting.length,
          overlapExamples: overlapExisting.slice(0, 5).map((c) => ({ title: c.title, repoUrl: c.repoUrl })),
        },
        q8_signalsSample: signals.slice(0, 8).map((s) => ({ source: s.source.key, title: s.title.slice(0, 80), status: s.status })),
        q9_candidatesSample: candidates.slice(0, 8).map((c) => ({
          source: c.source.key,
          title: c.title.slice(0, 60),
          review: c.reviewStatus,
          import: c.importStatus,
        })),
        signalsPerSource,
        candsPerSource,
        runSummary,
      },
      null,
      2,
    ),
  );
}

main().finally(() => prisma.$disconnect());
