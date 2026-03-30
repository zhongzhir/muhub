import { DiscoveredProjectCandidateStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { NormalizedDiscoveryCandidate } from "@/agents/discovery/github-normalize";

export async function upsertDiscoveredProjectCandidates(
  items: NormalizedDiscoveryCandidate[],
): Promise<{ upserted: number }> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL 未配置");
  }

  let upserted = 0;
  for (const item of items) {
    await prisma.discoveredProjectCandidate.upsert({
      where: {
        source_sourceId: { source: item.source, sourceId: item.sourceId },
      },
      create: {
        source: item.source,
        sourceId: item.sourceId,
        sourceUrl: item.sourceUrl,
        name: item.name,
        description: item.description,
        ownerName: item.ownerName,
        repoUrl: item.repoUrl,
        homepageUrl: item.homepageUrl,
        stars: item.stars,
        primaryLanguage: item.primaryLanguage,
        lastPushedAt: item.lastPushedAt,
        isChineseRelated: item.isChineseRelated,
        status: DiscoveredProjectCandidateStatus.pending,
        rawPayload: item.rawPayload as Prisma.InputJsonValue,
      },
      update: {
        sourceUrl: item.sourceUrl,
        name: item.name,
        description: item.description,
        ownerName: item.ownerName,
        repoUrl: item.repoUrl,
        homepageUrl: item.homepageUrl,
        stars: item.stars,
        primaryLanguage: item.primaryLanguage,
        lastPushedAt: item.lastPushedAt,
        isChineseRelated: item.isChineseRelated,
        rawPayload: item.rawPayload as Prisma.InputJsonValue,
      },
    });
    upserted += 1;
  }

  return { upserted };
}

export async function listPendingDiscoveredProjectCandidates() {
  if (!process.env.DATABASE_URL?.trim()) {
    return [];
  }
  return prisma.discoveredProjectCandidate.findMany({
    where: { status: DiscoveredProjectCandidateStatus.pending },
    orderBy: [{ isChineseRelated: "desc" }, { stars: "desc" }, { discoveredAt: "desc" }],
  });
}

export async function markDiscoveredCandidateImported(id: string) {
  await prisma.discoveredProjectCandidate.updateMany({
    where: { id, status: DiscoveredProjectCandidateStatus.pending },
    data: { status: DiscoveredProjectCandidateStatus.imported },
  });
}

export async function markDiscoveredCandidateDiscarded(id: string) {
  await prisma.discoveredProjectCandidate.updateMany({
    where: { id, status: DiscoveredProjectCandidateStatus.pending },
    data: { status: DiscoveredProjectCandidateStatus.discarded },
  });
}
