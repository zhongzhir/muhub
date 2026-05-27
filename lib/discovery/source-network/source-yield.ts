import type { PrismaClient } from "@prisma/client";
import type { DiscoveryScope } from "@/lib/discovery/discovery-scopes";
import { parseScopesFromConfigJson } from "@/lib/discovery/scope-from-config";

export type SourceYieldStats = {
  sourceId: string;
  signalCount: number;
  candidateCount: number;
  lastRun: {
    id: string;
    status: string;
    startedAt: Date;
    fetchedCount: number;
    parsedCount: number;
    newCandidateCount: number;
    errorMessage: string | null;
  } | null;
};

export async function fetchSourceYieldStats(
  db: PrismaClient,
  sourceIds: string[],
): Promise<Map<string, SourceYieldStats>> {
  if (sourceIds.length === 0) {
    return new Map();
  }

  const [signalGroups, candidateGroups, runs] = await Promise.all([
    db.discoverySignal.groupBy({
      by: ["sourceId"],
      where: { sourceId: { in: sourceIds } },
      _count: { id: true },
    }),
    db.discoveryCandidate.groupBy({
      by: ["sourceId"],
      where: { sourceId: { in: sourceIds } },
      _count: { id: true },
    }),
    db.discoveryRun.findMany({
      where: { sourceId: { in: sourceIds } },
      orderBy: { startedAt: "desc" },
      distinct: ["sourceId"],
      select: {
        id: true,
        sourceId: true,
        status: true,
        startedAt: true,
        fetchedCount: true,
        parsedCount: true,
        newCandidateCount: true,
        errorMessage: true,
      },
    }),
  ]);

  const signalMap = new Map(signalGroups.map((g) => [g.sourceId, g._count.id]));
  const candMap = new Map(candidateGroups.map((g) => [g.sourceId, g._count.id]));
  const runMap = new Map(runs.map((r) => [r.sourceId, r]));

  const out = new Map<string, SourceYieldStats>();
  for (const id of sourceIds) {
    const run = runMap.get(id);
    out.set(id, {
      sourceId: id,
      signalCount: signalMap.get(id) ?? 0,
      candidateCount: candMap.get(id) ?? 0,
      lastRun: run
        ? {
            id: run.id,
            status: run.status,
            startedAt: run.startedAt,
            fetchedCount: run.fetchedCount,
            parsedCount: run.parsedCount,
            newCandidateCount: run.newCandidateCount,
            errorMessage: run.errorMessage,
          }
        : null,
    });
  }
  return out;
}

export function sourceMatchesScopeFilter(
  configJson: unknown,
  scopeFilter: string | null | undefined,
): boolean {
  if (!scopeFilter?.trim()) {
    return true;
  }
  const scopes = parseScopesFromConfigJson(configJson);
  return scopes.includes(scopeFilter as DiscoveryScope) || scopeFilter === "all";
}
