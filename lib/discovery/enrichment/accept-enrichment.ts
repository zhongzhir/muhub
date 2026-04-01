import { prisma } from "@/lib/prisma";
import type { EnrichmentPlatform } from "@/lib/discovery/enrichment/classify-platform";
import { persistReviewPriorityForCandidateId } from "@/lib/discovery/persist-review-priority";

export type AcceptEnrichmentResult = {
  updatedLinkIds: string[];
  writtenFields: string[];
  skipped: { linkId: string; reason: string }[];
};

const empty = (v: string | null | undefined) => !v?.trim();

/**
 * 将选中的 enrichment links 标为已接受，并在候选字段为空时写回（不覆盖已有值）。
 */
export async function acceptDiscoveryEnrichmentLinks(
  candidateId: string,
  linkIds: string[],
): Promise<AcceptEnrichmentResult> {
  const ids = [...new Set(linkIds.map((x) => x.trim()).filter(Boolean))];
  const skipped: { linkId: string; reason: string }[] = [];
  if (ids.length === 0) {
    return { updatedLinkIds: [], writtenFields: [], skipped };
  }

  const links = await prisma.discoveryEnrichmentLink.findMany({
    where: { id: { in: ids }, candidateId },
  });

  const missing = ids.filter((id) => !links.some((l) => l.id === id));
  for (const id of missing) {
    skipped.push({ linkId: id, reason: "not found" });
  }

  if (links.length === 0) {
    return { updatedLinkIds: [], writtenFields: [], skipped };
  }

  const byPlatform = new Map<EnrichmentPlatform, (typeof links)[0]>();
  for (const link of links) {
    const plat = link.platform as EnrichmentPlatform;
    const cur = byPlatform.get(plat);
    if (!cur || link.confidence > cur.confidence) {
      byPlatform.set(plat, link);
    }
  }

  const cand = await prisma.discoveryCandidate.findUnique({
    where: { id: candidateId },
    select: {
      website: true,
      docsUrl: true,
      twitterUrl: true,
      youtubeUrl: true,
    },
  });
  if (!cand) {
    throw new Error("候选不存在");
  }

  const patch: {
    website?: string;
    docsUrl?: string;
    twitterUrl?: string;
    youtubeUrl?: string;
  } = {};
  const writtenFields: string[] = [];

  const trySet = (field: keyof typeof cand, plat: EnrichmentPlatform) => {
    const link = byPlatform.get(plat);
    if (!link) {
      return;
    }
    if (!empty(cand[field])) {
      skipped.push({ linkId: link.id, reason: `${String(field)} already set` });
      return;
    }
    patch[field] = link.url;
    writtenFields.push(String(field));
  };

  trySet("docsUrl", "docs");
  trySet("twitterUrl", "twitter");
  trySet("youtubeUrl", "youtube");
  trySet("website", "website");

  await prisma.$transaction(async (tx) => {
    for (const link of links) {
      await tx.discoveryEnrichmentLink.update({
        where: { id: link.id },
        data: { isAccepted: true },
      });
    }
    if (Object.keys(patch).length > 0) {
      await tx.discoveryCandidate.update({
        where: { id: candidateId },
        data: patch,
      });
    }
  });

  await persistReviewPriorityForCandidateId(prisma, candidateId);

  return {
    updatedLinkIds: links.map((l) => l.id),
    writtenFields,
    skipped,
  };
}
