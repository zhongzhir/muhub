"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { ProjectAiPublishQuality } from "@/lib/project-publishing";

export type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  status: string;
  visibilityStatus: string;
  primaryCategory: string | null;
  tags: string[];
  isPublic: boolean;
  updatedAtText: string;
  aiPublishQuality: ProjectAiPublishQuality;
};

function aiPublishQualityLabel(quality: ProjectAiPublishQuality): string {
  switch (quality) {
    case "full_ai":
      return "full_ai";
    case "partial_ai":
      return "partial_ai";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

function aiPublishQualityClass(quality: ProjectAiPublishQuality): string {
  switch (quality) {
    case "full_ai":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
    case "partial_ai":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  }
}

const CHECKBOX_COL_CLASS = "w-12 min-w-12 max-w-12 shrink-0 px-0 py-3 text-center";
const CHECKBOX_WRAP_CLASS = "flex items-center justify-center";

export function ProjectsAdminTable({ rows }: { rows: ProjectRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const rowIds = useMemo(() => new Set(rows.map((row) => row.id)), [rows]);
  const selectedIds = useMemo(() => Array.from(selected).filter((id) => rowIds.has(id)), [rowIds, selected]);
  const selectedCount = selectedIds.length;
  const hasSelection = selectedCount > 0;
  const allOnPage = rows.length > 0 && selectedCount === rows.length;

  useEffect(() => {
    setSelected((current) => {
      const next = new Set(Array.from(current).filter((id) => rowIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [rowIds]);

  async function runBulk(intent: "publish" | "hide" | "archive") {
    if (!selectedIds.length) {
      setMessage("请先选择项目。");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/projects/bulk-action", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, intent }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        count?: number;
        processed?: number;
        publishedCount?: number;
        blockedCount?: number;
        skippedCount?: number;
        warningCount?: number;
        counts?: {
          processed: number;
          published: number;
          blocked: number;
          skipped: number;
          warnings?: number;
        };
        message?: string;
        published?: Array<{ name: string }>;
        skipped?: Array<{ name: string; reason?: string }>;
        blocked?: Array<{ name: string; reason?: string }>;
        warnings?: Array<{ name: string; reason?: string; warnings?: string[] }>;
        partial_ai?: Array<{ name: string; notice?: string }>;
      };
      if (!res.ok || !json.ok) {
        setMessage(json.error ?? "批量操作失败。");
        return;
      }
      if (intent === "publish") {
        const counts = json.counts;
        const parts = [
          typeof counts?.processed === "number" ? `处理 ${counts.processed}` : typeof json.processed === "number" ? `处理 ${json.processed}` : null,
          typeof counts?.published === "number" ? `发布 ${counts.published}` : typeof json.publishedCount === "number" ? `发布 ${json.publishedCount}` : null,
          typeof counts?.skipped === "number" ? `跳过 ${counts.skipped}` : typeof json.skippedCount === "number" ? `跳过 ${json.skippedCount}` : null,
          typeof counts?.blocked === "number" ? `阻止 ${counts.blocked}` : typeof json.blockedCount === "number" ? `阻止 ${json.blockedCount}` : null,
          typeof counts?.warnings === "number" ? `警告 ${counts.warnings}` : typeof json.warningCount === "number" ? `警告 ${json.warningCount}` : null,
        ].filter(Boolean);
        const blockedReason = json.blocked?.find((item) => item.reason)?.reason;
        const warningReason = json.warnings?.find((item) => item.reason)?.reason;
        setMessage(
          parts.length
            ? `批量发布完成：${parts.join("，")}。${blockedReason ? ` 阻止原因：${blockedReason}` : ""}${warningReason ? ` 警告：${warningReason}` : ""}${json.message ? ` ${json.message}` : ""}`
            : json.message ?? "批量发布完成。",
        );
      } else {
        setMessage(`批量操作完成，共处理 ${json.count ?? 0} 个项目。`);
      }
      setSelected(new Set());
      router.refresh();
    } catch {
      setMessage("批量操作失败，请稍后重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-w-0 max-w-full space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
        <span className="text-zinc-600 dark:text-zinc-400">已选 {selectedCount} 项</span>
        <button type="button" disabled={pending || !hasSelection} onClick={() => runBulk("publish")} className="rounded bg-emerald-700 px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-60">
          {pending ? "处理中..." : "批量发布"}
        </button>
        <button type="button" disabled={pending || !hasSelection} onClick={() => runBulk("hide")} className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-300">
          {pending ? "处理中..." : "批量隐藏"}
        </button>
        <button type="button" disabled={pending || !hasSelection} onClick={() => runBulk("archive")} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-300">
          {pending ? "处理中..." : "批量归档"}
        </button>
        {message ? <span className="text-xs text-zinc-500">{message}</span> : null}
      </div>

      <div className="w-full max-w-full overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <table className="min-w-[1040px] w-full table-fixed text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/80">
            <tr>
              <th className={CHECKBOX_COL_CLASS}>
                <div className={CHECKBOX_WRAP_CLASS}>
                  <input
                    type="checkbox"
                    checked={allOnPage}
                    disabled={rows.length === 0}
                    onChange={() => {
                      if (allOnPage) {
                        setSelected(new Set());
                      } else {
                        setSelected(new Set(rows.map((r) => r.id)));
                      }
                    }}
                  />
                </div>
              </th>
              <th className="min-w-0 px-4 py-3">项目名称</th>
              <th className="w-[88px] px-4 py-3">状态</th>
              <th className="w-[88px] px-4 py-3">可见性</th>
              <th className="w-[96px] px-4 py-3">AI状态</th>
              <th className="w-[120px] px-4 py-3">分类</th>
              <th className="w-[180px] px-4 py-3">标签</th>
              <th className="w-[56px] px-4 py-3">公开</th>
              <th className="w-[140px] px-4 py-3">更新时间</th>
              <th className="w-[220px] px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-zinc-500">
                  暂无项目
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60">
                  <td className={CHECKBOX_COL_CLASS}>
                    <div className={CHECKBOX_WRAP_CLASS}>
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => {
                          const next = new Set(selected);
                          if (next.has(r.id)) next.delete(r.id);
                          else next.add(r.id);
                          setSelected(next);
                        }}
                      />
                    </div>
                  </td>
                  <td className="min-w-0 overflow-hidden px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    <div className="truncate">{r.name}</div>
                    <p className="mt-0.5 truncate text-xs font-normal text-zinc-500">{r.tagline || "—"}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">{r.status}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{r.visibilityStatus}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs ${aiPublishQualityClass(r.aiPublishQuality)}`}>
                      {aiPublishQualityLabel(r.aiPublishQuality)}
                    </span>
                  </td>
                  <td className="max-w-[120px] truncate px-4 py-3 text-zinc-700 dark:text-zinc-300">{r.primaryCategory || "—"}</td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-zinc-700 dark:text-zinc-300">{r.tags.length ? r.tags.slice(0, 4).map((tag) => `#${tag}`).join(" ") : "—"}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{r.isPublic ? "是" : "否"}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{r.updatedAtText}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/admin/projects/${r.id}/edit`} className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
                        编辑
                      </Link>
                      <Link href={`/admin/projects/${r.id}/publish`} className="text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">
                        发布设置
                      </Link>
                      <Link href={`/admin/projects/${r.id}/activity`} className="text-amber-700 underline-offset-2 hover:underline dark:text-amber-400">
                        项目动态
                      </Link>
                      <Link href={`/admin/marketing?projectId=${encodeURIComponent(r.id)}`} className="text-violet-600 underline-offset-2 hover:underline dark:text-violet-400">
                        营销中心
                      </Link>
                      {r.status === "PUBLISHED" ? (
                        <Link href={`/projects/${r.slug}`} target="_blank" className="text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300">
                          查看前台页
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
