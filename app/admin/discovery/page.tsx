import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ensureDiscoveryDefaultSources } from "@/lib/discovery/seed-default-sources";
import {
  discoveryCandidateOrderByFromParams,
  discoveryCandidateWhereFromSearchParams,
  nextSearchParamsToURLSearchParams,
} from "@/lib/discovery/candidate-list-query";
import { computeDiscoveryCandidateQualitySignals } from "@/lib/discovery/candidate-quality-signals";
import { buildDiscoveryFusionSummary } from "@/lib/discovery/review-priority";
import { fetchDiscoveryReviewSpotlights } from "@/lib/discovery/discovery-review-spotlights";
import { DiscoveryAdvancedFilters } from "./discovery-advanced-filters";
import type { CandidateListRow } from "./discovery-candidates-table";
import { DiscoveryCandidatesTable } from "./discovery-candidates-table";
import { DiscoveryListFilters } from "./discovery-list-filters";
import { RunDiscoveryBar } from "./run-discovery-bar";
import { DiscoveryReviewSpotlights } from "./discovery-review-spotlights";
import { RecomputeReviewPriorityButton } from "./recompute-priority-button";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminDiscoveryListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await ensureDiscoveryDefaultSources();

  const sp = await searchParams;
  const u = nextSearchParamsToURLSearchParams(sp);
  const page = Math.max(1, Number(u.get("page")) || 1);
  const pageSize = 30;

  const where = discoveryCandidateWhereFromSearchParams(u);
  const orderBy = discoveryCandidateOrderByFromParams(u.get("sort"), u.get("order"));

  const [sources, total, rows, spotlights] = await Promise.all([
    prisma.discoverySource.findMany({
      select: { key: true, name: true },
      orderBy: { key: "asc" },
    }),
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
        matchedProjectId: true,
        suggestedType: true,
        classificationScore: true,
        classificationStatus: true,
        isAiRelated: true,
        isChineseTool: true,
        externalType: true,
        enrichmentStatus: true,
        metadataJson: true,
        sourceKey: true,
        source: { select: { key: true, name: true } },
      },
    }),
    fetchDiscoveryReviewSpotlights(),
  ]);

  const tableRows: CandidateListRow[] = rows.map((r) => {
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
      stars: r.stars,
      score: r.score,
      reviewPriorityScore: r.reviewPriorityScore,
      reviewStatus: r.reviewStatus,
      importStatus: r.importStatus,
      firstSeenAt: r.firstSeenAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
      repoUpdatedAt: r.repoUpdatedAt?.toISOString() ?? null,
      repoUrl: r.repoUrl,
      sourceName: r.source.name,
      sourceKey: r.source.key,
      externalType: r.externalType,
      signals,
      matchedProjectId: r.matchedProjectId,
      suggestedType: r.suggestedType,
      classificationScore: r.classificationScore,
      classificationStatus: r.classificationStatus,
      isAiRelated: r.isAiRelated,
      isChineseTool: r.isChineseTool,
      enrichmentStatus: r.enrichmentStatus,
      multiSource: fusion.multiSource,
      productHuntFused: fusion.productHuntFused,
      contributingLabels: fusion.contributingLabels,
    };
  });

  const paramString = u.toString();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Discovery 候选池</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            抓取结果先入此池，审核通过后再进入正式项目（默认草稿，不自动发布到广场）。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/discovery/items"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
          >
            JSON 发现队列
          </Link>
          <Link
            href="/admin/discovery/sources"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
          >
            来源 / 运行健康
          </Link>
        </div>
      </header>

      <RunDiscoveryBar />

      {process.env.DATABASE_URL?.trim() ? (
        <DiscoveryReviewSpotlights
          worthFirst={spotlights.worthFirst}
          multiSource={spotlights.multiSource}
          wellFilled={spotlights.wellFilled}
          lowCleanup={spotlights.lowCleanup}
        />
      ) : null}

      <RecomputeReviewPriorityButton />

      <div className="space-y-3">
        <DiscoveryListFilters key={paramString} sources={sources} paramString={paramString} />
        <DiscoveryAdvancedFilters key={`adv-${paramString}`} paramString={paramString} />
      </div>

      <DiscoveryCandidatesTable
        rows={tableRows}
        paramString={paramString}
        page={page}
        pageSize={pageSize}
        total={total}
      />
    </div>
  );
}
