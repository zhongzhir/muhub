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
import { isHighConfidenceCandidate } from "@/lib/discovery/auto-convert-publishing-signals";
import { DiscoveryAdvancedFilters } from "./discovery-advanced-filters";
import type { CandidateListRow } from "./discovery-candidates-table";
import { DiscoveryCandidatesTable } from "./discovery-candidates-table";
import { DiscoveryListFilters } from "./discovery-list-filters";
import { RunDiscoveryBar } from "./run-discovery-bar";
import { DiscoveryReviewSpotlights } from "./discovery-review-spotlights";
import { RecomputeReviewPriorityButton } from "./recompute-priority-button";
import { DiscoveryHubNav } from "./discovery-hub-nav";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminDiscoveryListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await ensureDiscoveryDefaultSources();

  const sp = await searchParams;
  const query = nextSearchParamsToURLSearchParams(sp);
  const page = Math.max(1, Number(query.get("page")) || 1);
  const pageSize = 30;

  const where = discoveryCandidateWhereFromSearchParams(query);
  const orderBy = discoveryCandidateOrderByFromParams(query.get("sort"), query.get("order"));

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

  const tableRows: CandidateListRow[] = rows.map((row) => {
    const signals = computeDiscoveryCandidateQualitySignals({
      website: row.website,
      docsUrl: row.docsUrl,
      twitterUrl: row.twitterUrl,
      repoUrl: row.repoUrl,
      descriptionRaw: row.descriptionRaw,
      summary: row.summary,
      tagsJson: row.tagsJson,
      lastCommitAt: row.lastCommitAt,
      repoUpdatedAt: row.repoUpdatedAt,
      stars: row.stars,
    });
    const fusion = buildDiscoveryFusionSummary({
      externalType: row.externalType,
      sourceKey: row.sourceKey,
      metadataJson: row.metadataJson,
      repoUrl: row.repoUrl,
    });
    return {
      id: row.id,
      title: row.title,
      stars: row.stars,
      score: row.score,
      reviewPriorityScore: row.reviewPriorityScore,
      reviewStatus: row.reviewStatus,
      importStatus: row.importStatus,
      firstSeenAt: row.firstSeenAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      repoUpdatedAt: row.repoUpdatedAt?.toISOString() ?? null,
      repoUrl: row.repoUrl,
      sourceName: row.source.name,
      sourceKey: row.source.key,
      externalType: row.externalType,
      signals,
      matchedProjectId: row.matchedProjectId,
      suggestedType: row.suggestedType,
      classificationScore: row.classificationScore,
      classificationStatus: row.classificationStatus,
      isAiRelated: row.isAiRelated,
      isChineseTool: row.isChineseTool,
      enrichmentStatus: row.enrichmentStatus,
      multiSource: fusion.multiSource,
      productHuntFused: fusion.productHuntFused,
      contributingLabels: fusion.contributingLabels,
      highConfidenceCandidate: isHighConfidenceCandidate(row.metadataJson),
    };
  });

  const paramString = query.toString();

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">候选项目 · Candidate</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            GitHub / Product Hunt / 高置信 Signal 等进入此池。审核通过后导入为正式 Project（草稿 → 编辑 → 发布）。
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            名单、公告、实验室等<strong>不完整线索</strong>请先走{" "}
            <Link href="/admin/discovery/signals" className="underline">
              线索池
            </Link>
            与{" "}
            <Link href="/admin/discovery/entities" className="underline">
              实体线索 (E1)
            </Link>
            ，勿强行在此创建 Candidate。
          </p>
        </div>
        <DiscoveryHubNav current="candidates" />
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
