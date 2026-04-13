"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";

import {
  bulkImportAction,
  bulkMarkReviewedAction,
  bulkRejectAction,
  importDiscoveryItemAction,
  markDiscoveryItemNewAction,
  markDiscoveryItemRejectedAction,
  markDiscoveryItemReviewedAction,
} from "./actions";
import type { DiscoveryItem } from "@/agents/discovery/discovery-types";

const btn =
  "rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

function readMetaText(meta: Record<string, unknown> | undefined, key: string): string | null {
  const value = meta?.[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readMetaNumber(meta: Record<string, unknown> | undefined, key: string): number | null {
  const value = meta?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

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

function aiBadgeClass(status: DiscoveryItem["aiStatus"]) {
  switch (status) {
    case "scheduled":
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
    case "done":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
    default:
      return "bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400";
  }
}

function duplicateBadgeClass(row: DiscoveryItem) {
  if (row.duplicateOfId) {
    return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
  }
  if (row.possibleDuplicate) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  }
  return "bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400";
}

export function DiscoveryJsonQueueTable({ items }: { items: DiscoveryItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRunning, setBulkRunning] = useState<"reviewed" | "rejected" | "import" | null>(null);
  const itemIds = items.map((item) => item.id);
  const selectedValidIds = selectedIds.filter((id) => itemIds.includes(id));
  const selectedCount = selectedValidIds.length;
  const allSelected = items.length > 0 && selectedCount === items.length;

  function toggleRow(id: string): void {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAllCurrentPage(): void {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(itemIds);
  }

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
      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200">
          <span>Selected: {selectedCount}</span>
          <button
            type="button"
            disabled={pending}
            className={btn}
            onClick={() => {
              if (!window.confirm(`Confirm import ${selectedCount} items?`)) {
                return;
              }
              setFeedback(null);
              setBulkRunning("import");
              startTransition(() => {
                void (async () => {
                  const r = await bulkImportAction(selectedValidIds);
                  if (r.ok) {
                    setFeedback({
                      kind: "ok",
                      text: `Import completed\nSuccess: ${r.success}\nFailed: ${r.failed}\nSkipped: ${r.skipped}`,
                    });
                    setSelectedIds([]);
                    router.refresh();
                  } else {
                    setFeedback({ kind: "err", text: r.error || "批量 Import 失败" });
                  }
                  setBulkRunning(null);
                })();
              });
            }}
          >
            {bulkRunning === "import" ? "Importing..." : "Import"}
          </button>
          <button
            type="button"
            disabled={pending}
            className={btn}
            onClick={() => {
              setFeedback(null);
              setBulkRunning("reviewed");
              startTransition(() => {
                void (async () => {
                  const r = await bulkMarkReviewedAction(selectedValidIds);
                  if (r.ok) {
                    setFeedback({ kind: "ok", text: `Marked ${r.updated} items as reviewed` });
                    setSelectedIds([]);
                    router.refresh();
                  } else {
                    setFeedback({ kind: "err", text: r.error || "批量 Reviewed 失败" });
                  }
                  setBulkRunning(null);
                })();
              });
            }}
          >
            {bulkRunning === "reviewed" ? "Marking..." : "Mark Reviewed"}
          </button>
          <button
            type="button"
            disabled={pending}
            className={btn}
            onClick={() => {
              setFeedback(null);
              setBulkRunning("rejected");
              startTransition(() => {
                void (async () => {
                  const r = await bulkRejectAction(selectedValidIds);
                  if (r.ok) {
                    setFeedback({ kind: "ok", text: `Rejected ${r.updated} items` });
                    setSelectedIds([]);
                    router.refresh();
                  } else {
                    setFeedback({ kind: "err", text: r.error || "批量 Reject 失败" });
                  }
                  setBulkRunning(null);
                })();
              });
            }}
          >
            {bulkRunning === "rejected" ? "Rejecting..." : "Reject"}
          </button>
          <button
            type="button"
            disabled={pending}
            className={btn}
            onClick={() => setSelectedIds([])}
          >
            Clear
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          <tr>
            <th className="px-3 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAllCurrentPage}
                aria-label="全选当前页"
              />
            </th>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Meta</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">AI</th>
            <th className="px-4 py-3">Duplicate</th>
            <th className="px-4 py-3">CreatedAt</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((row) => (
            <tr key={row.id} className="align-top text-zinc-800 dark:text-zinc-200">
              <td className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(row.id)}
                  onChange={() => toggleRow(row.id)}
                  aria-label={`选择 ${row.title}`}
                />
              </td>
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
                {(() => {
                  const source = readMetaText(row.meta, "source") ?? row.sourceType;
                  const intent = readMetaText(row.meta, "intent");
                  const keyword = readMetaText(row.meta, "keyword");
                  const topic = readMetaText(row.meta, "topic");
                  const seedRepo = readMetaText(row.meta, "seedRepo");
                  const lastUpdated =
                    readMetaText(row.meta, "lastUpdated") ?? readMetaText(row.meta, "lastPushed");
                  const stars = readMetaNumber(row.meta, "stars");
                  return (
                    <div className="max-w-[280px] space-y-1 text-xs">
                      <div className="flex flex-wrap gap-1">
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                          {source}
                        </span>
                        {intent ? (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                            {intent}
                          </span>
                        ) : null}
                      </div>
                      <div className="space-y-0.5 text-zinc-500 dark:text-zinc-400">
                        {keyword ? <p className="truncate">kw: {keyword}</p> : null}
                        {topic ? <p className="truncate">topic: {topic}</p> : null}
                        {seedRepo ? <p className="truncate">seed: {seedRepo}</p> : null}
                      </div>
                      {stars !== null || lastUpdated ? (
                        <div className="space-y-0.5 text-zinc-500 dark:text-zinc-400">
                          {stars !== null ? <p>stars: {stars}</p> : null}
                          {lastUpdated ? <p className="truncate">updated: {lastUpdated}</p> : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </td>
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
              <td className="px-4 py-3">
                <span className={`rounded px-2 py-0.5 text-xs ${aiBadgeClass(row.aiStatus)}`}>
                  {row.aiStatus === "scheduled"
                    ? "Scheduled"
                    : row.aiStatus === "done"
                      ? "Done"
                      : row.aiStatus === "failed"
                        ? "Failed"
                        : "-"}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`rounded px-2 py-0.5 text-xs ${duplicateBadgeClass(row)}`}>
                  {row.duplicateOfId ? "Duplicate" : row.possibleDuplicate ? "Possible" : "-"}
                </span>
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
