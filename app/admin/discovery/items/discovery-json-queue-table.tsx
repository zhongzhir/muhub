"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";

import {
  importDiscoveryItemAction,
  markDiscoveryItemNewAction,
  markDiscoveryItemRejectedAction,
  markDiscoveryItemReviewedAction,
} from "./actions";
import type { DiscoveryItem } from "@/agents/discovery/discovery-types";

const btn =
  "rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

function statusBadgeClass(status: DiscoveryItem["status"]) {
  switch (status) {
    case "new":
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
    case "reviewed":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200";
    case "imported":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
    case "rejected":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  }
}

export function DiscoveryJsonQueueTable({ items }: { items: DiscoveryItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900/40">
        队列为空。运行 <code className="font-mono text-xs">pnpm discovery:items-demo</code> 写入示例条目。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {feedback ? (
        <p
          role="status"
          className={
            feedback.kind === "ok"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
              : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          }
        >
          {feedback.text}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">CreatedAt</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((row) => (
            <tr key={row.id} className="text-zinc-800 dark:text-zinc-200">
              <td className="px-4 py-3 font-medium">
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                >
                  {row.title}
                </a>
                {row.description ? (
                  <p className="mt-1 max-w-md text-xs font-normal text-zinc-500 dark:text-zinc-400">
                    {row.description}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3 text-xs">{row.sourceType}</td>
              <td className="px-4 py-3">
                <span className={`rounded px-2 py-0.5 text-xs ${statusBadgeClass(row.status)}`}>
                  {row.status}
                </span>
                {row.status === "imported" && row.projectSlug ? (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-normal">
                    <Link
                      href={`/projects/${row.projectSlug}`}
                      className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                    >
                      公开页
                    </Link>
                    <Link
                      href={`/dashboard/projects/${row.projectSlug}/edit`}
                      className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                    >
                      后台编辑
                    </Link>
                  </div>
                ) : null}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500 tabular-nums">
                {row.createdAt.replace("T", " ").slice(0, 19)}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {row.status === "imported" ? (
                    <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
                      Imported
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={pending || row.status === "rejected"}
                      className={`${btn} ${row.status === "rejected" ? "cursor-not-allowed opacity-50" : ""}`}
                      title={
                        row.status === "rejected"
                          ? "请先 Mark new 或 Reviewed 后再导入"
                          : "写入 Project 表并回写本队列"
                      }
                      onClick={() => {
                        setFeedback(null);
                        startTransition(() => {
                          void (async () => {
                            const r = await importDiscoveryItemAction(row.id);
                            if (r.ok) {
                              setFeedback({
                                kind: "ok",
                                text: `${r.message ?? "成功"}${r.slug ? `（slug: ${r.slug}）` : ""}`,
                              });
                              router.refresh();
                            } else {
                              setFeedback({
                                kind: "err",
                                text: r.message ?? "导入失败",
                              });
                            }
                          })();
                        });
                      }}
                    >
                      Import
                    </button>
                  )}
                  {row.status !== "reviewed" ? (
                    <button
                      type="button"
                      disabled={pending}
                      className={btn}
                      onClick={() =>
                        startTransition(() => void markDiscoveryItemReviewedAction(row.id))
                      }
                    >
                      Reviewed
                    </button>
                  ) : null}
                  {row.status !== "rejected" ? (
                    <button
                      type="button"
                      disabled={pending}
                      className={btn}
                      onClick={() =>
                        startTransition(() => void markDiscoveryItemRejectedAction(row.id))
                      }
                    >
                      Reject
                    </button>
                  ) : null}
                  {row.status !== "new" ? (
                    <button
                      type="button"
                      disabled={pending}
                      className={btn}
                      onClick={() =>
                        startTransition(() => void markDiscoveryItemNewAction(row.id))
                      }
                    >
                      Mark new
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}
