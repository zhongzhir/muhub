import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeDiscoveryCandidateQualitySignals } from "@/lib/discovery/candidate-quality-signals";

export const dynamic = "force-dynamic";

type CandidateRow = {
  id: string;
  title: string;
  sourceName: string;
  sourceKey: string;
  firstSeenAt: Date;
  reviewPriorityScore: number;
  reviewStatus: string;
  importStatus: string;
  enrichmentStatus: string;
  classificationStatus: string;
  suggestedType: string | null;
  isAiRelated: boolean | null;
  isChineseTool: boolean | null;
  repoUrl: string | null;
  website: string | null;
  docsUrl: string | null;
  twitterUrl: string | null;
  descriptionRaw: string | null;
  summary: string | null;
  tagsJson: unknown;
  lastCommitAt: Date | null;
  repoUpdatedAt: Date | null;
  stars: number;
  latestError: string | null;
};

function shanghaiDayRange(now = new Date()): { start: Date; end: Date; label: string } {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const start = new Date(Date.UTC(year, month, day) - 8 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const label = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { start, end, label };
}

function formatTime(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function latestFailure(row: {
  enrichmentJobs: Array<{ errorMessage: string | null }>;
  classificationJobs: Array<{ errorMessage: string | null }>;
}): string | null {
  return row.enrichmentJobs[0]?.errorMessage ?? row.classificationJobs[0]?.errorMessage ?? null;
}

function toCandidateRow(row: {
  id: string;
  title: string;
  firstSeenAt: Date;
  reviewPriorityScore: number;
  reviewStatus: string;
  importStatus: string;
  enrichmentStatus: string;
  classificationStatus: string;
  suggestedType: string | null;
  isAiRelated: boolean | null;
  isChineseTool: boolean | null;
  repoUrl: string | null;
  website: string | null;
  docsUrl: string | null;
  twitterUrl: string | null;
  descriptionRaw: string | null;
  summary: string | null;
  tagsJson: unknown;
  lastCommitAt: Date | null;
  repoUpdatedAt: Date | null;
  stars: number;
  source: { name: string; key: string };
  enrichmentJobs: Array<{ errorMessage: string | null }>;
  classificationJobs: Array<{ errorMessage: string | null }>;
}): CandidateRow {
  return {
    id: row.id,
    title: row.title,
    sourceName: row.source.name,
    sourceKey: row.source.key,
    firstSeenAt: row.firstSeenAt,
    reviewPriorityScore: row.reviewPriorityScore,
    reviewStatus: row.reviewStatus,
    importStatus: row.importStatus,
    enrichmentStatus: row.enrichmentStatus,
    classificationStatus: row.classificationStatus,
    suggestedType: row.suggestedType,
    isAiRelated: row.isAiRelated,
    isChineseTool: row.isChineseTool,
    repoUrl: row.repoUrl,
    website: row.website,
    docsUrl: row.docsUrl,
    twitterUrl: row.twitterUrl,
    descriptionRaw: row.descriptionRaw,
    summary: row.summary,
    tagsJson: row.tagsJson,
    lastCommitAt: row.lastCommitAt,
    repoUpdatedAt: row.repoUpdatedAt,
    stars: row.stars,
    latestError: latestFailure(row),
  };
}

function candidateSelect() {
  return {
    id: true,
    title: true,
    firstSeenAt: true,
    reviewPriorityScore: true,
    reviewStatus: true,
    importStatus: true,
    enrichmentStatus: true,
    classificationStatus: true,
    suggestedType: true,
    isAiRelated: true,
    isChineseTool: true,
    repoUrl: true,
    website: true,
    docsUrl: true,
    twitterUrl: true,
    descriptionRaw: true,
    summary: true,
    tagsJson: true,
    lastCommitAt: true,
    repoUpdatedAt: true,
    stars: true,
    source: { select: { name: true, key: true } },
    enrichmentJobs: {
      orderBy: { createdAt: "desc" as const },
      take: 1,
      select: { errorMessage: true },
    },
    classificationJobs: {
      orderBy: { createdAt: "desc" as const },
      take: 1,
      select: { errorMessage: true },
    },
  };
}

function isPublishReady(row: CandidateRow): boolean {
  const quality = computeDiscoveryCandidateQualitySignals(row);
  const hasUsefulSource = quality.hasRepo || quality.hasWebsite || quality.hasDocs;
  const hasAnalysis = row.enrichmentStatus === "OK" || ["DONE", "ACCEPTED"].includes(row.classificationStatus);
  return (
    row.reviewStatus === "PENDING" &&
    row.importStatus === "PENDING" &&
    row.reviewPriorityScore >= 45 &&
    hasUsefulSource &&
    quality.hasDescription &&
    hasAnalysis
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {children}
    </span>
  );
}

function CandidateList({ title, rows, empty }: { title: string; rows: CandidateRow[]; empty: string }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">{title}</h2>
        <span className="text-xs tabular-nums text-zinc-500">{rows.length}</span>
      </div>
      {rows.length ? (
        <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/admin/discovery/${row.id}`}
              className="block py-3 hover:bg-zinc-50 dark:hover:bg-zinc-950/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-zinc-950 dark:text-zinc-50">{row.title}</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {row.sourceName} · {formatTime(row.firstSeenAt)}
                  </p>
                  {row.latestError ? (
                    <p className="mt-1 break-words text-xs text-red-600 dark:text-red-400">{row.latestError}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  <Badge>优先级 {row.reviewPriorityScore}</Badge>
                  <Badge>{row.enrichmentStatus}</Badge>
                  <Badge>{row.classificationStatus}</Badge>
                  {row.suggestedType ? <Badge>{row.suggestedType}</Badge> : null}
                  {row.isAiRelated ? <Badge>AI</Badge> : null}
                  {row.isChineseTool ? <Badge>中国相关</Badge> : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded bg-zinc-50 px-3 py-4 text-sm text-zinc-500 dark:bg-zinc-950/40">{empty}</p>
      )}
    </section>
  );
}

export default async function AdminDiscoveryDailyPage() {
  const { start, end, label } = shanghaiDayRange();
  const candidateSelection = candidateSelect();

  const [
    runs,
    totalNew,
    totalPending,
    totalDuplicates,
    totalFailures,
    newRowsRaw,
    pendingRowsRaw,
    duplicateRowsRaw,
    failedRowsRaw,
    mobileFailedRows,
  ] = await Promise.all([
    prisma.discoveryRun.findMany({
      where: { startedAt: { gte: start, lt: end } },
      orderBy: { startedAt: "desc" },
      take: 12,
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        fetchedCount: true,
        parsedCount: true,
        newCandidateCount: true,
        updatedCandidateCount: true,
        errorMessage: true,
        source: { select: { name: true, key: true } },
      },
    }),
    prisma.discoveryCandidate.count({ where: { firstSeenAt: { gte: start, lt: end } } }),
    prisma.discoveryCandidate.count({ where: { reviewStatus: "PENDING", importStatus: "PENDING" } }),
    prisma.discoveryCandidate.count({
      where: {
        OR: [
          { importStatus: "SKIPPED" },
          { matchedProjectId: { not: null } },
          { metadataJson: { path: ["possibleDuplicate"], equals: true } },
        ],
        updatedAt: { gte: start, lt: end },
      },
    }),
    prisma.discoveryCandidate.count({
      where: {
        OR: [{ enrichmentStatus: "FAILED" }, { classificationStatus: "FAILED" }],
        updatedAt: { gte: start, lt: end },
      },
    }),
    prisma.discoveryCandidate.findMany({
      where: { firstSeenAt: { gte: start, lt: end } },
      orderBy: [{ reviewPriorityScore: "desc" }, { firstSeenAt: "desc" }],
      take: 10,
      select: candidateSelection,
    }),
    prisma.discoveryCandidate.findMany({
      where: { reviewStatus: "PENDING", importStatus: "PENDING" },
      orderBy: [{ reviewPriorityScore: "desc" }, { firstSeenAt: "desc" }],
      take: 20,
      select: candidateSelection,
    }),
    prisma.discoveryCandidate.findMany({
      where: {
        OR: [
          { importStatus: "SKIPPED" },
          { matchedProjectId: { not: null } },
          { metadataJson: { path: ["possibleDuplicate"], equals: true } },
        ],
        updatedAt: { gte: start, lt: end },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: candidateSelection,
    }),
    prisma.discoveryCandidate.findMany({
      where: {
        OR: [{ enrichmentStatus: "FAILED" }, { classificationStatus: "FAILED" }],
        updatedAt: { gte: start, lt: end },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: candidateSelection,
    }),
    prisma.discoveryCandidate.findMany({
      where: {
        metadataJson: { path: ["meta", "autoExtractionStatus"], equals: "failed" },
        updatedAt: { gte: start, lt: end },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, title: true, metadataJson: true, updatedAt: true },
    }),
  ]);

  const newRows = newRowsRaw.map(toCandidateRow);
  const pendingRows = pendingRowsRaw.map(toCandidateRow);
  const duplicateRows = duplicateRowsRaw.map(toCandidateRow);
  const failedRows = failedRowsRaw.map(toCandidateRow);
  const publishReadyRows = pendingRows.filter(isPublishReady).slice(0, 10);
  const runTotals = runs.reduce(
    (acc, run) => ({
      fetched: acc.fetched + run.fetchedCount,
      parsed: acc.parsed + run.parsedCount,
      newCandidates: acc.newCandidates + run.newCandidateCount,
      updatedCandidates: acc.updatedCandidates + run.updatedCandidateCount,
    }),
    { fetched: 0, parsed: 0, newCandidates: 0, updatedCandidates: 0 },
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/admin/discovery" className="underline-offset-4 hover:underline">
              返回发现队列
            </Link>
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            今日 AI 发现工作台
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            统计口径：北京时间 {label}。AI 相关只是标签和加分项，优先级仍以项目真实性、创新性和来源质量为主。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/discovery/tasks" className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">
            抓取任务
          </Link>
          <Link href="/admin/discovery/mobile" className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">
            手机采集
          </Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="今日新增候选" value={totalNew} href="/admin/discovery?sort=firstSeenAt&order=desc" />
        <StatCard label="今日重复/已关联" value={totalDuplicates} />
        <StatCard label="待审核候选" value={totalPending} href="/admin/discovery?importStatus=PENDING&sort=reviewPriority&order=desc" />
        <StatCard label="建议优先发布审核" value={publishReadyRows.length} />
        <StatCard label="今日处理失败" value={totalFailures + mobileFailedRows.length} />
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">今日抓取运行</h2>
          <p className="text-xs text-zinc-500">
            fetched {runTotals.fetched} · parsed {runTotals.parsed} · new {runTotals.newCandidates} · updated{" "}
            {runTotals.updatedCandidates}
          </p>
        </div>
        {runs.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="px-2 py-2">来源</th>
                  <th className="px-2 py-2">状态</th>
                  <th className="px-2 py-2">抓取/解析/新增/更新</th>
                  <th className="px-2 py-2">时间</th>
                  <th className="px-2 py-2">失败原因</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-2 py-2">
                      <p>{run.source.name}</p>
                      <p className="text-xs text-zinc-500">{run.source.key}</p>
                    </td>
                    <td className="px-2 py-2">{run.status}</td>
                    <td className="px-2 py-2 tabular-nums">
                      {run.fetchedCount}/{run.parsedCount}/{run.newCandidateCount}/{run.updatedCandidateCount}
                    </td>
                    <td className="px-2 py-2 text-xs text-zinc-500">
                      {formatTime(run.startedAt)} - {formatTime(run.finishedAt)}
                    </td>
                    <td className="max-w-xs break-words px-2 py-2 text-xs text-red-600 dark:text-red-400">
                      {run.errorMessage ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 rounded bg-zinc-50 px-3 py-4 text-sm text-zinc-500 dark:bg-zinc-950/40">
            今天还没有 DiscoveryRun 记录。若使用 GitHub V3 JSON 队列脚本，运行摘要可能只出现在 JSON run history 中。
          </p>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <CandidateList title="今日新增候选" rows={newRows} empty="今天暂无新增候选。" />
        <CandidateList title="建议优先发布审核" rows={publishReadyRows} empty="暂无满足来源质量和分析状态的高优先级候选。" />
        <CandidateList title="待审核高优先级" rows={pendingRows.slice(0, 10)} empty="暂无待审核候选。" />
        <CandidateList title="重复/已关联线索" rows={duplicateRows} empty="今天暂无重复或已关联线索。" />
        <CandidateList title="候选处理失败" rows={failedRows} empty="今天暂无候选补全或分类失败。" />

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">手机采集自动提取失败</h2>
            <span className="text-xs tabular-nums text-zinc-500">{mobileFailedRows.length}</span>
          </div>
          {mobileFailedRows.length ? (
            <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
              {mobileFailedRows.map((row) => {
                const meta = asObject(asObject(row.metadataJson).meta);
                const error = typeof meta.autoExtractionError === "string" ? meta.autoExtractionError : null;
                return (
                  <Link
                    key={row.id}
                    href="/admin/discovery/mobile"
                    className="block py-3 hover:bg-zinc-50 dark:hover:bg-zinc-950/40"
                  >
                    <p className="break-words text-sm font-medium text-zinc-950 dark:text-zinc-50">{row.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">{formatTime(row.updatedAt)}</p>
                    {error ? <p className="mt-1 break-words text-xs text-red-600 dark:text-red-400">{error}</p> : null}
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 rounded bg-zinc-50 px-3 py-4 text-sm text-zinc-500 dark:bg-zinc-950/40">
              今天暂无手机采集自动提取失败。
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
