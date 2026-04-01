import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildDiscoveryFusionSummary } from "@/lib/discovery/review-priority";

const PENDING_WORK: Prisma.DiscoveryCandidateWhereInput = {
  reviewStatus: "PENDING",
  importStatus: "PENDING",
};

export type DiscoverySpotlightItem = {
  id: string;
  title: string;
  reviewPriorityScore: number;
};

function isWellFilledRow(r: {
  website: string | null;
  repoUrl: string | null;
  docsUrl: string | null;
  reviewPriorityScore: number;
}): boolean {
  const w = Boolean(r.website?.trim());
  const g = Boolean(r.repoUrl?.trim());
  const d = Boolean(r.docsUrl?.trim());
  return r.reviewPriorityScore >= 45 && (w || g) && (d || g);
}

function isLowCleanupRow(r: {
  reviewPriorityScore: number;
  stars: number;
  website: string | null;
  repoUrl: string | null;
  summary: string | null;
  descriptionRaw: string | null;
}): boolean {
  const thinText =
    !r.summary?.trim() &&
    !r.descriptionRaw?.trim();
  const noLinks = !r.website?.trim() && !r.repoUrl?.trim();
  return (
    r.reviewPriorityScore <= 14 &&
    r.stars <= 3 &&
    thinText &&
    noLinks
  );
}

export async function fetchDiscoveryReviewSpotlights(): Promise<{
  worthFirst: DiscoverySpotlightItem[];
  multiSource: DiscoverySpotlightItem[];
  wellFilled: DiscoverySpotlightItem[];
  lowCleanup: DiscoverySpotlightItem[];
}> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { worthFirst: [], multiSource: [], wellFilled: [], lowCleanup: [] };
  }

  const pool = await prisma.discoveryCandidate.findMany({
    where: PENDING_WORK,
    select: {
      id: true,
      title: true,
      reviewPriorityScore: true,
      stars: true,
      website: true,
      repoUrl: true,
      docsUrl: true,
      summary: true,
      descriptionRaw: true,
      externalType: true,
      sourceKey: true,
      metadataJson: true,
    },
    orderBy: [{ reviewPriorityScore: "desc" }, { lastSeenAt: "desc" }],
    take: 120,
  });

  const worthFirst: DiscoverySpotlightItem[] = pool.slice(0, 8).map((r) => ({
    id: r.id,
    title: r.title,
    reviewPriorityScore: r.reviewPriorityScore,
  }));

  const multiSource: DiscoverySpotlightItem[] = [];
  for (const r of pool) {
    const f = buildDiscoveryFusionSummary({
      externalType: r.externalType,
      sourceKey: r.sourceKey,
      metadataJson: r.metadataJson,
      repoUrl: r.repoUrl,
    });
    if (f.multiSource) {
      multiSource.push({
        id: r.id,
        title: r.title,
        reviewPriorityScore: r.reviewPriorityScore,
      });
    }
    if (multiSource.length >= 8) {
      break;
    }
  }

  const wellFilled: DiscoverySpotlightItem[] = [];
  for (const r of pool) {
    if (isWellFilledRow(r)) {
      wellFilled.push({
        id: r.id,
        title: r.title,
        reviewPriorityScore: r.reviewPriorityScore,
      });
    }
    if (wellFilled.length >= 8) {
      break;
    }
  }

  const lowCleanup: DiscoverySpotlightItem[] = [];
  const lowPool = await prisma.discoveryCandidate.findMany({
    where: {
      ...PENDING_WORK,
      reviewPriorityScore: { lte: 16 },
    },
    select: {
      id: true,
      title: true,
      reviewPriorityScore: true,
      stars: true,
      website: true,
      repoUrl: true,
      summary: true,
      descriptionRaw: true,
    },
    orderBy: { reviewPriorityScore: "asc" },
    take: 40,
  });
  for (const r of lowPool) {
    if (isLowCleanupRow(r)) {
      lowCleanup.push({
        id: r.id,
        title: r.title,
        reviewPriorityScore: r.reviewPriorityScore,
      });
    }
    if (lowCleanup.length >= 8) {
      break;
    }
  }

  return { worthFirst, multiSource, wellFilled, lowCleanup };
}
