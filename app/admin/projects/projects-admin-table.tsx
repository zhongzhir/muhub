"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type ProjectRow = {
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
};

export function ProjectsAdminTable({ rows }: { rows: ProjectRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const allOnPage = useMemo(() => rows.length > 0 && selected.size === rows.length, [rows.length, selected.size]);

  async function runBulk(intent: "publish" | "hide" | "archive") {
    if (selected.size === 0) {
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
        body: JSON.stringify({ ids: Array.from(selected), intent }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; count?: number };
      if (!res.ok || !json.ok) {
        setMessage(json.error ?? "批量操作失败。");
        return;
      }
      setMessage(`批量操作完成，共处理 ${json.count ?? 0} 个项目。`);
      setSelected(new Set());
      router.refresh();
    } catch {
      setMessage("批量操作失败，请稍后重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
        <span className="text-zinc-600 dark:text-zinc-400">已选 {selected.size} 项</span>
        <button type="button" disabled={pending} onClick={() => runBulk("publish")} className="rounded bg-emerald-700 px-2 py-1 text-xs text-white disabled:opacity-60">
          {pending ? "处理中..." : "批量发布"}
        </button>
        <button type="button" disabled={pending} onClick={() => runBulk("hide")} className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-300">
          {pending ? "处理中..." : "批量隐藏"}
        </button>
        <button type="button" disabled={pending} onClick={() => runBulk("archive")} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-60 dark:border-red-800 dark:text-red-300">
          {pending ? "处理中..." : "批量归档"}
        </button>
        {message ? <span className="text-xs text-zinc-500">{message}</span> : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/80">
            <tr>
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={allOnPage}
                  onChange={() => {
                    if (allOnPage) {
                      setSelected(new Set());
                    } else {
                      setSelected(new Set(rows.map((r) => r.id)));
                    }
                  }}
                />
              </th>
              <th className="px-4 py-3">项目名称</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">可见性</th>
              <th className="px-4 py-3">分类</th>
              <th className="px-4 py-3">标签</th>
              <th className="px-4 py-3">公开</th>
              <th className="px-4 py-3">更新时间</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                  暂无项目
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60">
                  <td className="px-3 py-3">
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
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {r.name}
                    <p className="mt-0.5 text-xs font-normal text-zinc-500">{r.tagline || "—"}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">{r.status}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{r.visibilityStatus}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{r.primaryCategory || "—"}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{r.tags.length ? r.tags.slice(0, 4).map((tag) => `#${tag}`).join(" ") : "—"}</td>
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
