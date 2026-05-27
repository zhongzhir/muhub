/** Quick before/after counters for discovery run */
import { PrismaClient } from "@prisma/client";
import { parseScopesFromConfigJson } from "../lib/discovery/scope-from-config";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const sources = await prisma.discoverySource.findMany({
    select: { id: true, key: true, configJson: true },
  });
  const pubIds = sources
    .filter((s) => {
      const scopes = parseScopesFromConfigJson(s.configJson);
      return scopes.includes("publishing_ai") || s.key.startsWith("publishing-");
    })
    .map((s) => s.id);

  const [signals, candidates, signalsAll, candidatesAll] = await Promise.all([
    prisma.discoverySignal.count({ where: { sourceId: { in: pubIds } } }),
    prisma.discoveryCandidate.count({ where: { sourceId: { in: pubIds } } }),
    prisma.discoverySignal.count(),
    prisma.discoveryCandidate.count(),
  ]);

  console.log(
    JSON.stringify({
      publishingSourceIds: pubIds.length,
      publishingSignals: signals,
      publishingCandidates: candidates,
      allSignals: signalsAll,
      allCandidates: candidatesAll,
    }),
  );
}

main().finally(() => prisma.$disconnect());
