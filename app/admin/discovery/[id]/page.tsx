import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeDiscoveryCandidateQualitySignals } from "@/lib/discovery/candidate-quality-signals";
import type { ReviewPrioritySignals } from "@/lib/discovery/review-priority";
import { buildDiscoveryFusionSummary } from "@/lib/discovery/review-priority";
import { CandidateDetailActions } from "./candidate-detail-actions";
import { CandidateClassificationPanel } from "./candidate-classification-panel";
import { CandidateEnrichmentPanel } from "./candidate-enrichment-panel";

export const dynamic = "force-dynamic";

function DiscoveryDetailFallback({
  id,
  error,
}: {
  id: string;
  error: unknown;
}) {
  const message = error instanceof Error ? error.message : "未知错误";

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/discovery" className="underline">
          ← 候选列表
        </Link>
      </p>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
        <h1 className="text-lg font-semibold">待筛选项目详情暂时不可用</h1>
        <p className="mt-2">
          当前候选项目 ID：
          {" "}
          <code>{id}</code>
        </p>
        <p className="mt-2">
          页面已降级返回，避免整页 500。请先检查数据库 migration 是否已执行完成，再刷新重试。
        </p>
        <p className="mt-3 text-xs opacity-80">错误信息：{message}</p>
      </section>
    </div>
  );
}

export default async function AdminDiscoveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const row = await prisma.discoveryCandidate.findUnique({
      where: { id },
      include: {
        source: { select: { key: true, name: true, type: true, subtype: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        matchedProject: { select: { id: true, slug: true, name: true } },
        enrichmentJobs: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            extractedCount: true,
            errorMessage: true,
          },
        },
        enrichmentLinks: {
          orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            platform: true,
            url: true,
            normalizedUrl: true,
            host: true,
            source: true,
            confidence: true,
            isPrimary: true,
            isAccepted: true,
            evidenceText: true,
            jobId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        classificationJobs: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            errorMessage: true,
          },
        },
      },
    });

    if (!row) {
      notFound();
    }

    const rawStr = JSON.stringify(row.rawPayloadJson ?? null, null, 2);
    const metaStr = JSON.stringify(row.metadataJson ?? null, null, 2);
    const tags =
      Array.isArray(row.tagsJson) &&
      row.tagsJson.every((t) => typeof t === "string")
        ? (row.tagsJson as string[])
        : [];

    const categories =
      Array.isArray(row.categoriesJson) &&
      row.categoriesJson.every((t) => typeof t === "string")
        ? (row.categoriesJson as string[])
        : [];

    const suggestedTags =
      Array.isArray(row.suggestedTagsJson) &&
      row.suggestedTagsJson.every((t) => typeof t === "string")
        ? (row.suggestedTagsJson as string[])
        : [];

    const classificationEvidence =
      Array.isArray(row.classificationEvidenceJson) &&
      row.classificationEvidenceJson.every((x) => typeof x === "string")
        ? (row.classificationEvidenceJson as string[])
        : [];

    const canMutate =
      row.importStatus !== "IMPORTED" &&
      row.reviewStatus !== "REJECTED" &&
      row.reviewStatus !== "IGNORED";

    const fusion = buildDiscoveryFusionSummary({
      externalType: row.externalType,
      sourceKey: row.sourceKey,
      metadataJson: row.metadataJson,
      repoUrl: row.repoUrl,
    });

    const prioritySignals = row.reviewPrioritySignals as ReviewPrioritySignals | null;

    const quality = computeDiscoveryCandidateQualitySignals({
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

    return (
      <div className="space-y-8">
        <p className="text-sm text-zinc-500">
          <Link href="/admin/discovery" className="underline">
            ← 候选列表
          </Link>
        </p>

        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{row.title}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {row.source?.name ?? "未知来源"} · {row.externalType} · 审核 {row.reviewStatus} · 导入{" "}
            {row.importStatus}
            {row.reviewStatus === "IGNORED" ? (
              <span className="ml-2 text-amber-700 dark:text-amber-300">（已忽略，不进入待办）</span>
            ) : null}
          </p>
        </header>

        <section className="rounded-xl border border-violet-200/80 bg-violet-50/40 p-4 dark:border-violet-900/50 dark:bg-violet-950/25">
          <h2 className="text-sm font-semibold text-violet-950 dark:text-violet-100">审核优先级与多来源</h2>
          <dl className="mt-2 grid gap-1 text-sm text-zinc-800 dark:text-zinc-200 sm:grid-cols-2">
            <dt className="text-xs text-violet-800/80 dark:text-violet-300/90">reviewPriorityScore</dt>
            <dd className="tabular-nums font-semibold">{row.reviewPriorityScore.toFixed(1)}</dd>
            <dt className="text-xs text-violet-800/80 dark:text-violet-300/90">多来源</dt>
            <dd>
              {fusion.multiSource ? "是" : "否"}
              {fusion.contributingLabels.length
                ? `（${fusion.contributingLabels.join(" · ")}）`
                : ""}
            </dd>
            <dt className="text-xs text-violet-800/80 dark:text-violet-300/90">PH 已并入 GitHub 元数据</dt>
            <dd>{fusion.productHuntFused ? "是" : "否"}</dd>
          </dl>
          {fusion.productHunt ? (
            <div className="mt-3 rounded-lg border border-orange-200/80 bg-white/80 p-3 text-xs dark:border-orange-900/40 dark:bg-zinc-900/40">
              <p className="font-medium text-orange-950 dark:text-orange-100">Product Hunt（metadata）</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-zinc-700 dark:text-zinc-300">
                <li>投票：{fusion.productHunt.votes ?? "—"}</li>
                <li>快照次数：{fusion.productHunt.snapshotCount}</li>
                {fusion.productHunt.lastSyncIso ? (
                  <li>最近同步：{fusion.productHunt.lastSyncIso}</li>
                ) : null}
              </ul>
            </div>
          ) : null}
          {prioritySignals?.factors?.length ? (
            <div className="mt-3 text-xs">
              <p className="font-medium text-zinc-700 dark:text-zinc-300">因子分解</p>
              <ul className="mt-1 max-h-40 overflow-auto rounded border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900/60">
                {prioritySignals.factors.map((f) => (
                  <li key={f.id} className="tabular-nums text-zinc-600 dark:text-zinc-400">
                    +{f.points} · {f.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">质量信号</h2>
          <dl className="mt-2 grid gap-1 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-2">
            <dt className="text-xs text-zinc-500">hasWebsite / hasDocs / hasTwitter / hasRepo</dt>
            <dd>
              {String(quality.hasWebsite)} / {String(quality.hasDocs)} /{" "}
              {String(quality.hasTwitter)} / {String(quality.hasRepo)}
            </dd>
            <dt className="text-xs text-zinc-500">hasDescription / hasTopics / hasRecentCommit</dt>
            <dd>
              {String(quality.hasDescription)} / {String(quality.hasTopics)} /{" "}
              {String(quality.hasRecentCommit)}
            </dd>
            <dt className="text-xs text-zinc-500">isPopular / isFresh</dt>
            <dd>
              {String(quality.isPopular)} / {String(quality.isFresh)}
            </dd>
          </dl>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">GitHub / 仓库</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">normalizedKey</dt>
                <dd className="font-mono text-xs break-all">{row.normalizedKey ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">repo</dt>
                <dd>
                  {row.repoUrl ? (
                    <a href={row.repoUrl} className="text-blue-600 underline" target="_blank" rel="noreferrer">
                      {row.repoUrl}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">owner</dt>
                <dd>
                  {row.ownerUrl ? (
                    <a href={row.ownerUrl} className="underline" target="_blank" rel="noreferrer">
                      {row.ownerName}
                    </a>
                  ) : (
                    row.ownerName ?? "—"
                  )}
                </dd>
              </div>
              <div className="flex flex-wrap gap-3 tabular-nums">
                <span>★ {row.stars}</span>
                <span>forks {row.forks}</span>
                <span>watch {row.watchers}</span>
                <span>issues {row.issues}</span>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">语言 / 许可</dt>
                <dd>
                  {row.language ?? "—"} · {row.openSourceLicense ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">pushed / updated</dt>
                <dd className="text-xs text-zinc-600">
                  {row.lastCommitAt?.toISOString() ?? "—"}
                  <br />
                  {row.repoUpdatedAt?.toISOString() ?? "—"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">外链与摘要</h2>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
              <li>
                官网：{" "}
                {row.website ? (
                  <a href={row.website} className="underline" target="_blank" rel="noreferrer">
                    {row.website}
                  </a>
                ) : (
                  "—"
                )}
              </li>
              <li>
                文档：{" "}
                {row.docsUrl ? (
                  <a href={row.docsUrl} className="underline" target="_blank" rel="noreferrer">
                    {row.docsUrl}
                  </a>
                ) : (
                  "—"
                )}
              </li>
              <li>
                X/Twitter：{" "}
                {row.twitterUrl ? (
                  <a href={row.twitterUrl} className="underline" target="_blank" rel="noreferrer">
                    {row.twitterUrl}
                  </a>
                ) : (
                  "—"
                )}
              </li>
              <li>
                YouTube：{" "}
                {row.youtubeUrl ? (
                  <a href={row.youtubeUrl} className="underline" target="_blank" rel="noreferrer">
                    {row.youtubeUrl}
                  </a>
                ) : (
                  "—"
                )}
              </li>
            </ul>
            {row.summary ? (
              <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {row.summary}
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">标签与类目</h2>
          <p className="mt-1 text-xs text-zinc-500">正式 tagsJson / categoriesJson（人工或导入；Accept 分类会追加缺失项）</p>
          <p className="mt-2 text-sm text-zinc-600">
            标签：{tags.length ? tags.map((t) => `#${t}`).join("  ") : "—"}
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            类目：{categories.length ? categories.join(" · ") : "—"}
          </p>
        </section>

        <CandidateClassificationPanel
          candidateId={row.id}
          classificationStatus={row.classificationStatus}
          suggestedType={row.suggestedType}
          suggestedTags={suggestedTags}
          classificationScore={row.classificationScore}
          evidence={classificationEvidence}
          isAiRelated={row.isAiRelated}
          isChineseTool={row.isChineseTool}
          formalCategories={categories}
          lastJob={
            row.classificationJobs[0]
              ? {
                  id: row.classificationJobs[0].id,
                  status: row.classificationJobs[0].status,
                  startedAt: row.classificationJobs[0].startedAt.toISOString(),
                  finishedAt: row.classificationJobs[0].finishedAt?.toISOString() ?? null,
                  errorMessage: row.classificationJobs[0].errorMessage,
                }
              : null
          }
        />

        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">评分</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">总分</dt>
              <dd className="tabular-nums text-lg font-medium">{row.score ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">热度 / 新鲜度 / 质量</dt>
              <dd className="tabular-nums">
                {row.popularityScore ?? "—"} · {row.freshnessScore ?? "—"} ·{" "}
                {row.qualityScore ?? "—"}
              </dd>
            </div>
          </dl>
        </section>

        {row.matchedProject ? (
          <section className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <h2 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">已导入 Project</h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link
                href={`/projects/${row.matchedProject.slug}`}
                className="font-medium text-emerald-800 underline dark:text-emerald-300"
              >
                {row.matchedProject.name}
              </Link>
              <span className="font-mono text-xs text-zinc-500">({row.matchedProject.id})</span>
              <Link
                href={`/admin/projects/${row.matchedProject.id}/edit`}
                className="text-sm font-medium text-emerald-900 underline dark:text-emerald-200"
              >
                后台编辑项目
              </Link>
              <Link
                href={`/admin/marketing?projectId=${encodeURIComponent(row.matchedProject.id)}`}
                className="text-sm font-medium text-emerald-900 underline dark:text-emerald-200"
              >
                去营销中心
              </Link>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/admin/projects/${row.matchedProject.id}/edit`} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                下一步：后台编辑项目
              </Link>
              <Link href={`/admin/marketing?projectId=${encodeURIComponent(row.matchedProject.id)}`} className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-900 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-200">
                下一步：去营销中心
              </Link>
            </div>
            {row.importStatus === "IMPORTED" ? (
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-zinc-700 dark:text-zinc-300">
                <li>
                  溯源：<code className="text-[11px]">importedFromCandidateId</code>、
                  <code className="text-[11px]">discoverySource</code> /{" "}
                  <code className="text-[11px]">discoverySourceId</code>、
                  <code className="text-[11px]">discoveredAt</code> 在导入为新项目时已写入。
                </li>
                <li>
                  若 <code className="text-[11px]">classificationStatus = ACCEPTED</code>
                  ，导入/合并时会将当前候选的 <code className="text-[11px]">categoriesJson</code>、
                  <code className="text-[11px]">tagsJson</code>、<code className="text-[11px]">isAiRelated</code> /{" "}
                  <code className="text-[11px]">isChineseTool</code> 按合并规则写入 Project（不覆盖人工已明确的否定项）。
                </li>
                <li>
                  候选上“已接受”的自动信息补全链接会以{" "}
                  <code className="text-[11px]">source = discovery_enrichment</code> 写入{" "}
                  <code className="text-[11px]">ProjectExternalLink</code>；官网/文档等已在候选字段中的链接仍以{" "}
                  <code className="text-[11px]">discovery-approve</code> 或{" "}
                  <code className="text-[11px]">discovery-merge</code> 标记。
                </li>
              </ul>
            ) : null}
          </section>
        ) : null}

        <CandidateEnrichmentPanel
          candidateId={row.id}
          enrichmentStatus={row.enrichmentStatus}
          current={{
            website: row.website,
            docsUrl: row.docsUrl,
            twitterUrl: row.twitterUrl,
            youtubeUrl: row.youtubeUrl,
          }}
          links={row.enrichmentLinks.map((l) => ({
            ...l,
            createdAt: l.createdAt.toISOString(),
            updatedAt: l.updatedAt.toISOString(),
          }))}
          lastJob={
            row.enrichmentJobs[0]
              ? {
                  id: row.enrichmentJobs[0].id,
                  status: row.enrichmentJobs[0].status,
                  startedAt: row.enrichmentJobs[0].startedAt.toISOString(),
                  finishedAt: row.enrichmentJobs[0].finishedAt?.toISOString() ?? null,
                  extractedCount: row.enrichmentJobs[0].extractedCount,
                  errorMessage: row.enrichmentJobs[0].errorMessage,
                }
              : null
          }
        />

        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">操作</h2>
          <div className="mt-4">
            <CandidateDetailActions candidateId={row.id} canMutate={canMutate} />
          </div>
        </section>

        <details className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-600 dark:bg-zinc-900/30">
          <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">
            开发态：raw payload / metadata
          </summary>
          <pre className="mt-3 max-h-[360px] overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
            {rawStr}
          </pre>
          <pre className="mt-3 max-h-[200px] overflow-auto rounded-lg bg-zinc-800 p-3 text-xs text-zinc-100">
            {metaStr}
          </pre>
        </details>
      </div>
    );
  } catch (error) {
    console.error("[admin-discovery-detail]", { candidateId: id, error });
    return <DiscoveryDetailFallback id={id} error={error} />;
  }
}
