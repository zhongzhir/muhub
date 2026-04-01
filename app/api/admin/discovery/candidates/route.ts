import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import {
  discoveryCandidateOrderByFromParams,
  discoveryCandidateWhereFromSearchParams,
} from "@/lib/discovery/candidate-list-query";
import { computeDiscoveryCandidateQualitySignals } from "@/lib/discovery/candidate-quality-signals";
import { buildDiscoveryFusionSummary } from "@/lib/discovery/review-priority";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireMuHubAdmin();
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return Response.json(
        { ok: false, error: e.message },
        { status: e.code === "UNAUTHORIZED" ? 401 : 403 },
      );
    }
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 20));

  const where = discoveryCandidateWhereFromSearchParams(searchParams);
  const orderBy = discoveryCandidateOrderByFromParams(
    searchParams.get("sort"),
    searchParams.get("order"),
  );

  const [total, rows] = await Promise.all([
    prisma.discoveryCandidate.count({ where }),
    prisma.discoveryCandidate.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        stars: true,
        repoUrl: true,
        website: true,
        docsUrl: true,
        twitterUrl: true,
        descriptionRaw: true,
        summary: true,
        tagsJson: true,
        lastCommitAt: true,
        repoUpdatedAt: true,
        score: true,
        reviewPriorityScore: true,
        reviewStatus: true,
        importStatus: true,
        firstSeenAt: true,
        lastSeenAt: true,
        externalType: true,
        enrichmentStatus: true,
        metadataJson: true,
        sourceKey: true,
        matchedProjectId: true,
        suggestedType: true,
        classificationScore: true,
        classificationStatus: true,
        isAiRelated: true,
        isChineseTool: true,
        source: { select: { key: true, name: true, type: true } },
      },
    }),
  ]);

  return Response.json({
    ok: true,
    page,
    pageSize,
    total,
    items: rows.map((r) => {
      const signals = computeDiscoveryCandidateQualitySignals({
        website: r.website,
        docsUrl: r.docsUrl,
        twitterUrl: r.twitterUrl,
        repoUrl: r.repoUrl,
        descriptionRaw: r.descriptionRaw,
        summary: r.summary,
        tagsJson: r.tagsJson,
        lastCommitAt: r.lastCommitAt,
        repoUpdatedAt: r.repoUpdatedAt,
        stars: r.stars,
      });
      const fusion = buildDiscoveryFusionSummary({
        externalType: r.externalType,
        sourceKey: r.sourceKey,
        metadataJson: r.metadataJson,
        repoUrl: r.repoUrl,
      });
      return {
        id: r.id,
        title: r.title,
        source: r.source.key,
        sourceName: r.source.name,
        sourceType: r.source.type,
        externalType: r.externalType,
        reviewPriorityScore: r.reviewPriorityScore,
        enrichmentStatus: r.enrichmentStatus,
        multiSource: fusion.multiSource,
        productHuntFused: fusion.productHuntFused,
        contributingLabels: fusion.contributingLabels,
        stars: r.stars,
        repoUrl: r.repoUrl,
        website: r.website,
        docsUrl: r.docsUrl,
        twitterUrl: r.twitterUrl,
        score: r.score,
        reviewStatus: r.reviewStatus,
        importStatus: r.importStatus,
        firstSeenAt: r.firstSeenAt.toISOString(),
        lastSeenAt: r.lastSeenAt.toISOString(),
        repoUpdatedAt: r.repoUpdatedAt?.toISOString() ?? null,
        matchedProjectId: r.matchedProjectId,
        hasMatchedProject: Boolean(r.matchedProjectId),
        signals,
        linkFlags: {
          website: signals.hasWebsite,
          docs: signals.hasDocs,
          twitter: signals.hasTwitter,
          repo: signals.hasRepo,
        },
        suggestedType: r.suggestedType,
        classificationScore: r.classificationScore,
        classificationStatus: r.classificationStatus,
        isAiRelated: r.isAiRelated,
        isChineseTool: r.isChineseTool,
      };
    }),
  });
}
