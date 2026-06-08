import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isEntityFeedbackEnabled } from "@/lib/discovery/discovery-feature-flags";
import { parseAiJudgeEvidence } from "@/lib/discovery/entity/ai-entity-judge";
import {
  buildEntityHintListHref,
  buildEntityHintWhereInput,
  parseEntityHintListFilters,
} from "@/lib/discovery/entity/entity-hint-list-filters";
import { ENTITY_HINT_STATUSES, ENTITY_TYPES } from "@/lib/discovery/entity/types";
import { DISCOVERY_SCOPES } from "@/lib/discovery/discovery-scopes";
import { EntityHintFeedbackActions } from "./entity-hint-feedback-actions";
import { EntityHintStatusButtons } from "./entity-hint-status-buttons";
import { DiscoveryHubNav } from "../discovery-hub-nav";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function statusBadgeClass(status: string): string {
  if (status === "PENDING") {
    return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }
  if (status === "ACCEPTED") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
  if (status === "MERGED_LATER") {
    return "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200";
  }
  return "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200";
}

function formatScopes(scopes: unknown): string {
  if (!Array.isArray(scopes)) {
    return "—";
  }
  const items = scopes.filter((s): s is string => typeof s === "string");
  return items.length > 0 ? items.join(", ") : "—";
}

export default async function AdminDiscoveryEntitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseEntityHintListFilters(sp);
  const { status, entityType, scope, q, sourceKey, sourceName } = filters;
  const where = buildEntityHintWhereInput(filters);
  const feedbackEnabled = isEntityFeedbackEnabled();

  const rows = await prisma.entityHint.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      sourceSignal: {
        select: { id: true, sourceName: true, signalType: true, source: { select: { key: true } } },
      },
      _count: {
        select: { feedbacks: true },
      },
      feedbacks: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          action: true,
          isHighValue: true,
          shouldTrackLongTerm: true,
        },
      },
    },
  });

  const [filteredTotal, pendingInFilter, acceptedInFilter, rejectedInFilter] = await Promise.all([
    prisma.entityHint.count({ where }),
    prisma.entityHint.count({ where: { ...where, status: "PENDING" } }),
    prisma.entityHint.count({ where: { ...where, status: "ACCEPTED" } }),
    prisma.entityHint.count({ where: { ...where, status: "REJECTED" } }),
  ]);

  const filterSummary =
    status !== "ALL" || entityType !== "ALL" || scope !== "ALL" || q || sourceKey || sourceName
      ? "当前筛选下"
      : "全库";

  return (
    <div className="space-y-6">
      <DiscoveryHubNav current="entities" />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">实体线索 · Entity Hint (E1 / E1.5 / E1.6)</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          从 Signal 抽取的机构、实验室、项目名等<strong>不完整实体线索</strong>。WEBSITE_SCAN 默认走
          AI Entity Judge（E1.5）。
          {filterSummary}共 {filteredTotal} 条，待审 {pendingInFilter} 条（status=PENDING）。
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Entity E2（合并、验证、晋升 Project）<strong>暂缓</strong>。
          {feedbackEnabled
            ? " E1.6 反馈已开启：列表操作会打开结构化 feedback 面板。"
            : " 开启 ENTITY_FEEDBACK_ENABLED 后可使用结构化 feedback。"}
        </p>
        {sourceKey || sourceName ? (
          <p className="mt-1 text-xs text-zinc-500">
            sourceKey: {sourceKey || "ALL"} / sourceName: {sourceName || "ALL"} / total {filteredTotal} / PENDING {pendingInFilter} / ACCEPTED {acceptedInFilter} / REJECTED {rejectedInFilter}
          </p>
        ) : null}
      </header>

      <section className="flex flex-wrap gap-2 text-sm">
        <span className="text-zinc-500">状态：</span>
        {(["ALL", ...ENTITY_HINT_STATUSES] as const).map((value) => (
          <Link
            key={value}
            href={buildEntityHintListHref({ ...filters, status: value })}
            className={`rounded-full border px-2.5 py-0.5 ${
              status === value
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {value}
          </Link>
        ))}
      </section>

      <section className="flex flex-wrap gap-2 text-sm">
        <span className="text-zinc-500">类型：</span>
        {(["ALL", ...ENTITY_TYPES] as const).map((value) => (
          <Link
            key={value}
            href={buildEntityHintListHref({ ...filters, entityType: value })}
            className={`rounded-full border px-2.5 py-0.5 ${
              entityType === value
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {value}
          </Link>
        ))}
      </section>

      <section className="flex flex-wrap gap-2 text-sm">
        <span className="text-zinc-500">Scope：</span>
        {(["ALL", ...DISCOVERY_SCOPES] as const).map((value) => (
          <Link
            key={value}
            href={buildEntityHintListHref({ ...filters, scope: value })}
            className={`rounded-full border px-2.5 py-0.5 ${
              scope === value
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {value}
          </Link>
        ))}
      </section>

      <form method="get" className="flex flex-wrap items-center gap-2">
        {status !== "ALL" ? <input type="hidden" name="status" value={status} /> : null}
        {entityType !== "ALL" ? <input type="hidden" name="entityType" value={entityType} /> : null}
        {scope !== "ALL" ? <input type="hidden" name="scope" value={scope} /> : null}
        {sourceKey ? <input type="hidden" name="sourceKey" value={sourceKey} /> : null}
        {sourceName ? <input type="hidden" name="sourceName" value={sourceName} /> : null}
        <input
          name="q"
          defaultValue={q}
          placeholder="搜索名称、来源标题、reason"
          className="min-w-[240px] rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
        >
          搜索
        </button>
      </form>

      <form method="get" className="flex flex-wrap items-center gap-2">
        {status !== "ALL" ? <input type="hidden" name="status" value={status} /> : null}
        {entityType !== "ALL" ? <input type="hidden" name="entityType" value={entityType} /> : null}
        {scope !== "ALL" ? <input type="hidden" name="scope" value={scope} /> : null}
        {q ? <input type="hidden" name="q" value={q} /> : null}
        <input
          name="sourceKey"
          defaultValue={sourceKey}
          placeholder="sourceKey，例如 publishing-publishing-perspectives"
          className="min-w-[300px] rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          name="sourceName"
          defaultValue={sourceName}
          placeholder="sourceName"
          className="min-w-[180px] rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
        >
          Filter Source
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900/60">
            <tr>
              <th className="px-3 py-2">名称</th>
              <th className="px-3 py-2">类型</th>
              <th className="px-3 py-2">置信度</th>
              <th className="px-3 py-2">Relevance</th>
              <th className="px-3 py-2">Judge</th>
              <th className="px-3 py-2">状态</th>
              {feedbackEnabled ? (
                <>
                  <th className="px-3 py-2">Feedback</th>
                  <th className="px-3 py-2">标记</th>
                </>
              ) : null}
              <th className="px-3 py-2">Scope</th>
              <th className="px-3 py-2">来源</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">时间</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={feedbackEnabled ? 13 : 11}
                  className="px-3 py-8 text-center text-zinc-500"
                >
                  暂无 Entity Hint。可运行{" "}
                  <code className="text-xs">
                    pnpm tsx scripts/extract-entity-hints.ts --scope publishing_ai --limit 50
                  </code>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const aiEv = parseAiJudgeEvidence(row.evidenceJson);
                const feedbackCount = row._count.feedbacks;
                const hasHighValue = row.feedbacks.some((f) => f.isHighValue === true);
                const hasLongTerm = row.feedbacks.some((f) => f.shouldTrackLongTerm === true);

                return (
                  <tr
                    key={row.id}
                    className="border-t border-zinc-100 dark:border-zinc-800/80"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/discovery/entities/${row.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{row.entityType}</td>
                    <td className="px-3 py-2">
                      {typeof row.confidence === "number" ? row.confidence.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {aiEv.publishingAiRelevance != null
                        ? aiEv.publishingAiRelevance.toFixed(2)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {aiEv.isAiJudge ? (
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                          AI Judge
                        </span>
                      ) : (
                        "规则"
                      )}
                      {row.sourceSignal?.source?.key ? (
                        <div className="mt-1 font-mono text-[11px] text-zinc-400">
                          {row.sourceSignal.source.key}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    {feedbackEnabled ? (
                      <>
                        <td className="px-3 py-2 text-xs">
                          {feedbackCount > 0 ? (
                            <Link
                              href={`/admin/discovery/entities/${row.id}#feedback-history`}
                              className="underline"
                            >
                              {feedbackCount} 条
                            </Link>
                          ) : (
                            <span className="text-zinc-400">无</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="flex flex-wrap gap-1">
                            {hasHighValue ? (
                              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                                高价值
                              </span>
                            ) : null}
                            {hasLongTerm ? (
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                                长期
                              </span>
                            ) : null}
                            {!hasHighValue && !hasLongTerm ? "—" : null}
                          </div>
                        </td>
                      </>
                    ) : null}
                    <td className="px-3 py-2 text-xs">{formatScopes(row.discoveryScopes)}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.sourceSignal ? (
                        <Link
                          href={`/admin/discovery/signals/${row.sourceSignal.id}`}
                          className="underline"
                        >
                          {row.sourceSignal.sourceName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {row.reason ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {row.createdAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-3 py-2">
                      {feedbackEnabled ? (
                        <EntityHintFeedbackActions
                          hintId={row.id}
                          hintName={row.name}
                          compact
                        />
                      ) : (
                        <EntityHintStatusButtons hintId={row.id} currentStatus={row.status} />
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
