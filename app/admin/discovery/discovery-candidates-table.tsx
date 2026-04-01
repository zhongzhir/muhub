"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { DiscoveryCandidateQualitySignals } from "@/lib/discovery/candidate-quality-signals";
import { mergeAdminCandidateListUrl } from "@/lib/discovery/admin-candidate-list-url";

export type CandidateListRow = {
  id: string;
  title: string;
  stars: number;
  score: number | null;
  reviewPriorityScore: number;
  reviewStatus: string;
  importStatus: string;
  firstSeenAt: string;
  lastSeenAt: string;
  repoUpdatedAt: string | null;
  repoUrl: string | null;
  sourceName: string;
  sourceKey: string;
  externalType: string;
  signals: DiscoveryCandidateQualitySignals;
  matchedProjectId: string | null;
  suggestedType: string | null;
  classificationScore: number | null;
  classificationStatus: string;
  isAiRelated: boolean | null;
  isChineseTool: boolean | null;
  enrichmentStatus: string;
  multiSource: boolean;
  productHuntFused: boolean;
  contributingLabels: string[];
};

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`rounded px-1 py-0.5 text-[10px] font-medium ${
        on
          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
      }`}
      title={label}
    >
      {label}
    </span>
  );
}

export function DiscoveryCandidatesTable(props: {
  rows: CandidateListRow[];
  paramString: string;
  page: number;
  pageSize: number;
  total: number;
}) {
  const { rows, paramString, page, pageSize, total } = props;
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = useCallback((id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });
  }, []);

  const toggleAllOnPage = useCallback(() => {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  }, [rows, selected.size]);

  const runBulk = (path: string) => {
    if (selected.size === 0) {
      setBulkMessage("请先勾选候选");
      return;
    }
    setBulkMessage(null);
    start(async () => {
      const res = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        results?: { id: string; success: boolean; reason?: string }[];
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setBulkMessage(json.error ?? `HTTP ${res.status}`);
        return;
      }
      const ok = json.results?.filter((r) => r.success).length ?? 0;
      const fail = json.results?.filter((r) => !r.success).length ?? 0;
      setBulkMessage(`完成：成功 ${ok}，失败 ${fail}`);
      setSelected(new Set());
      router.refresh();
    });
  };

  const base = new URLSearchParams(paramString);
  const prevHref =
    page > 1 ? mergeAdminCandidateListUrl(base, { page: String(page - 1) }) : null;
  const nextHref =
    rows.length === pageSize
      ? mergeAdminCandidateListUrl(base, { page: String(page + 1) })
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/50">
        <span className="text-zinc-600 dark:text-zinc-400">
          已选 {selected.size} 条
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => runBulk("/api/admin/discovery/candidates/bulk-approve")}
          className="rounded bg-emerald-700 px-2 py-1 text-xs text-white disabled:opacity-50"
        >
          批量 Approve→DRAFT
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => runBulk("/api/admin/discovery/candidates/bulk-reject")}
          className="rounded border border-red-300 px-2 py-1 text-xs text-red-800 disabled:opacity-50 dark:border-red-800 dark:text-red-300"
        >
          批量 Reject
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => runBulk("/api/admin/discovery/candidates/bulk-ignore")}
          className="rounded border border-zinc-400 px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-600"
        >
          批量 Ignore
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => runBulk("/api/admin/discovery/candidates/bulk-enrich")}
          className="rounded border border-indigo-400 bg-indigo-50 px-2 py-1 text-xs text-indigo-900 disabled:opacity-50 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200"
          title="对选中候选依次运行 Enrichment（GitHub + 官网）"
        >
          批量 Enrichment
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => runBulk("/api/admin/discovery/candidates/bulk-classify")}
          className="rounded border border-violet-400 bg-violet-50 px-2 py-1 text-xs text-violet-900 disabled:opacity-50 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-200"
          title="对选中候选依次运行规则分类"
        >
          批量 Classification
        </button>
        {bulkMessage ? (
          <span className="text-xs text-zinc-600 dark:text-zinc-400">{bulkMessage}</span>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            <tr>
              <th className="px-2 py-2">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selected.size === rows.length}
                  onChange={toggleAllOnPage}
                  aria-label="全选本页"
                />
              </th>
              <th className="px-2 py-2">标题</th>
              <th className="px-2 py-2">优先级</th>
              <th className="px-2 py-2">来源</th>
              <th className="px-2 py-2">★</th>
              <th className="px-2 py-2">分</th>
              <th className="px-2 py-2">审核/导入</th>
              <th className="px-2 py-2">分类</th>
              <th className="px-2 py-2">链接</th>
              <th className="px-2 py-2">质量</th>
              <th className="px-2 py-2">关联</th>
              <th className="px-2 py-2">时间</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800/80">
                <td className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    aria-label={`选择 ${r.title}`}
                  />
                </td>
                <td className="max-w-[200px] px-2 py-2">
                  <Link
                    href={`/admin/discovery/${r.id}`}
                    className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                  >
                    {r.title}
                  </Link>
                  {r.repoUrl ? (
                    <div className="truncate text-[10px] text-zinc-500">
                      <a href={r.repoUrl} target="_blank" rel="noreferrer" className="hover:underline">
                        repo
                      </a>
                    </div>
                  ) : null}
                </td>
                <td className="px-2 py-2 text-xs">
                  <div className="tabular-nums font-semibold text-violet-800 dark:text-violet-200">
                    {r.reviewPriorityScore.toFixed(0)}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {r.multiSource ? (
                      <span
                        className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-950 dark:bg-amber-950/50 dark:text-amber-100"
                        title={r.contributingLabels.join(" · ")}
                      >
                        多来源
                      </span>
                    ) : null}
                    {r.productHuntFused ? (
                      <span className="rounded bg-orange-100 px-1 py-0.5 text-[9px] font-medium text-orange-950 dark:bg-orange-950/40 dark:text-orange-100">
                        PH→GH
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-0.5 text-[9px] text-zinc-600 dark:text-zinc-400">
                    <Flag on={r.signals.hasWebsite} label="W" />
                    <Flag on={r.signals.hasDocs} label="D" />
                    <Flag on={r.signals.hasRepo} label="G" />
                    <Flag on={r.classificationStatus === "ACCEPTED"} label="Cls✓" />
                    <Flag on={r.enrichmentStatus === "OK"} label="Enr✓" />
                  </div>
                </td>
                <td className="px-2 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <div>{r.sourceName}</div>
                  <div className="font-mono text-[10px] text-violet-700 dark:text-violet-400">
                    {r.externalType}
                  </div>
                  {r.contributingLabels.length ? (
                    <div className="mt-0.5 text-[9px] text-zinc-500" title="融合来源标签">
                      {r.contributingLabels.join(" · ")}
                    </div>
                  ) : null}
                </td>
                <td className="px-2 py-2 tabular-nums">{r.stars}</td>
                <td className="px-2 py-2 tabular-nums">{r.score ?? "—"}</td>
                <td className="px-2 py-2 text-[10px] leading-tight text-zinc-600">
                  {r.reviewStatus}
                  <br />
                  {r.importStatus}
                </td>
                <td className="max-w-[140px] px-2 py-2 text-[10px] leading-tight text-zinc-600">
                  <div className="truncate font-medium text-violet-800 dark:text-violet-300" title={r.suggestedType ?? ""}>
                    {r.suggestedType ?? "—"}
                  </div>
                  <div className="tabular-nums text-zinc-500">
                    {r.classificationScore != null ? r.classificationScore.toFixed(2) : "—"} · {r.classificationStatus}
                  </div>
                  <div className="flex gap-0.5">
                    <Flag on={Boolean(r.isAiRelated)} label="AI" />
                    <Flag on={Boolean(r.isChineseTool)} label="中" />
                  </div>
                </td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap gap-0.5">
                    <Flag on={r.signals.hasWebsite} label="W" />
                    <Flag on={r.signals.hasDocs} label="D" />
                    <Flag on={r.signals.hasTwitter} label="T" />
                    <Flag on={r.signals.hasRepo} label="R" />
                  </div>
                </td>
                <td className="px-2 py-2 text-[10px] text-zinc-500">
                  {r.signals.isPopular ? "热 " : ""}
                  {r.signals.isFresh ? "新 " : ""}
                  {r.signals.hasTopics ? "# " : ""}
                  {r.signals.hasDescription ? "文" : ""}
                </td>
                <td className="px-2 py-2 text-center text-xs">
                  {r.matchedProjectId ? (
                    <span className="text-emerald-700 dark:text-emerald-400" title={r.matchedProjectId}>
                      ✓
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-2 py-2 text-[10px] text-zinc-500">
                  <div>首 {r.firstSeenAt.slice(0, 10)}</div>
                  <div>见 {r.lastSeenAt.slice(0, 10)}</div>
                  <div>更 {r.repoUpdatedAt?.slice(0, 10) ?? "—"}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">暂无数据。</p>
        ) : null}
      </div>

      <p className="text-xs text-zinc-500">
        共 {total} 条 · 第 {page} 页 · 优先级列：W/D/G 官网·文档·仓库、Cls✓ 分类已接受、Enr✓ 补全成功；链接列 T 推特；分类列
        AI/中 为 isAiRelated / isChineseTool
      </p>

      <div className="flex gap-4 text-sm">
        {prevHref ? (
          <Link href={prevHref} className="underline">
            上一页
          </Link>
        ) : null}
        {nextHref ? (
          <Link href={nextHref} className="underline">
            下一页
          </Link>
        ) : null}
      </div>
    </div>
  );
}
