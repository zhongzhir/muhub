"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useTransition, useState } from "react";

import {
  bulkDeleteDiscoveryItemsAction,
  bulkImportAction,
  bulkMarkReviewedAction,
  bulkRejectAction,
  importDiscoveryItemAction,
  markDiscoveryItemNewAction,
  markDiscoveryItemRejectedAction,
  markDiscoveryItemReviewedAction,
} from "./actions";
import { MobileAutoExtractButton } from "../mobile/mobile-auto-extract-button";
import {
  isSourceMaterialDiscoveryItem,
  sourceMaterialExtractionStatusLabel,
} from "@/lib/discovery/source-material";
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

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
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

function readMetaObjectArray(
  meta: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown>[] {
  const value = meta?.[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
  );
}

function readMetaObject(
  meta: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | null {
  const value = meta?.[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function discoveryItemSearchHaystack(row: DiscoveryItem): string {
  const parts: string[] = [
    row.title,
    row.url,
    row.description ?? "",
    row.sourceType,
    row.status,
    row.duplicateOfId ?? "",
    row.possibleDuplicate ? "疑似 duplicate 重复" : "",
    row.duplicateOfId ? "重复 duplicate" : "",
  ];
  const meta = row.meta ?? {};
  for (const key of [
    "source",
    "sourceLabel",
    "sourceKey",
    "sourceName",
    "githubUrl",
    "websiteUrl",
    "sourceArticleUrl",
    "extractedUrl",
    "keyword",
    "topic",
    "intent",
    "articleTitle",
    "autoExtractionStatus",
    "autoExtractionError",
    "autoExtractionReason",
  ]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) {
      parts.push(value.trim());
    }
  }
  const queued = readMetaObject(meta, "autoExtractionQueued");
  if (queued) {
    parts.push(JSON.stringify(queued));
  }
  for (const dup of readMetaObjectArray(meta, "autoExtractionDuplicates")) {
    parts.push(JSON.stringify(dup));
  }
  return parts.join("\n").toLowerCase();
}

function matchesDiscoverySearch(row: DiscoveryItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  return discoveryItemSearchHaystack(row).includes(q);
}

export function DiscoveryJsonQueueTable({ items }: { items: DiscoveryItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkRunning, setBulkRunning] = useState<"reviewed" | "rejected" | "import" | "delete" | null>(null);

  const filteredItems = useMemo(
    () => items.filter((row) => matchesDiscoverySearch(row, searchQuery)),
    [items, searchQuery],
  );
  const itemIds = filteredItems.map((item) => item.id);
  const selectedValidIds = selectedIds.filter((id) => itemIds.includes(id));
  const selectedCount = selectedValidIds.length;
  const allSelected = filteredItems.length > 0 && selectedCount === filteredItems.length;

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
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="min-w-[220px] flex-1 text-sm text-zinc-700 dark:text-zinc-300">
          检索队列
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="标题 / URL / GitHub / source / meta / duplicate / 简介关键词"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-blue-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            当前显示 {filteredItems.length} / 全部 {items.length}
          </span>
          {searchQuery.trim() ? (
            <button
              type="button"
              className={btn}
              onClick={() => setSearchQuery("")}
            >
              清空搜索
            </button>
          ) : null}
        </div>
      </div>
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
          <span>已选：{selectedCount}</span>
          <button
            type="button"
            disabled={pending}
            className={btn}
            onClick={() => {
              if (!window.confirm(`确认导入 ${selectedCount} 条记录？`)) {
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
                      text: `导入完成\n成功：${r.success}\n失败：${r.failed}\n跳过：${r.skipped}`,
                    });
                    setSelectedIds([]);
                    router.refresh();
                  } else {
                    setFeedback({ kind: "err", text: r.error || "批量导入失败" });
                  }
                  setBulkRunning(null);
                })();
              });
            }}
          >
            {bulkRunning === "import" ? "导入中..." : "导入项目"}
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
                    setFeedback({ kind: "ok", text: `已处理 ${r.updated} 条` });
                    setSelectedIds([]);
                    router.refresh();
                  } else {
                    setFeedback({ kind: "err", text: r.error || "批量已处理失败" });
                  }
                  setBulkRunning(null);
                })();
              });
            }}
          >
            {bulkRunning === "reviewed" ? "处理中..." : "已处理"}
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
                    setFeedback({ kind: "ok", text: `已拒绝 ${r.updated} 条` });
                    setSelectedIds([]);
                    router.refresh();
                  } else {
                    setFeedback({ kind: "err", text: r.error || "批量拒绝失败" });
                  }
                  setBulkRunning(null);
                })();
              });
            }}
          >
            {bulkRunning === "rejected" ? "拒绝中..." : "拒绝"}
          </button>
          <button
            type="button"
            disabled={pending}
            className={btn}
            onClick={() => {
              if (!window.confirm(`确认从 JSON 队列删除 ${selectedCount} 条记录？此操作不会删除已入库项目。`)) {
                return;
              }
              setFeedback(null);
              setBulkRunning("delete");
              startTransition(() => {
                void (async () => {
                  const r = await bulkDeleteDiscoveryItemsAction(selectedValidIds);
                  if (r.ok) {
                    setFeedback({ kind: "ok", text: `已删除 ${r.deleted} 条队列记录` });
                    setSelectedIds([]);
                    router.refresh();
                  } else {
                    setFeedback({ kind: "err", text: r.error || "删除队列记录失败" });
                  }
                  setBulkRunning(null);
                })();
              });
            }}
          >
            {bulkRunning === "delete" ? "删除中..." : "删除所选"}
          </button>
          <button
            type="button"
            disabled={pending}
            className={btn}
            onClick={() => setSelectedIds([])}
          >
            取消选择
          </button>
        </div>
      ) : null}
      {filteredItems.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900/40">
          没有匹配「{searchQuery.trim()}」的队列条目。
        </p>
      ) : (
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
            <th className="px-4 py-3">项目</th>
            <th className="px-4 py-3">来源</th>
            <th className="px-4 py-3">Meta</th>
            <th className="px-4 py-3">状态</th>
            <th className="px-4 py-3">AI</th>
            <th className="px-4 py-3">Duplicate</th>
            <th className="px-4 py-3">创建时间</th>
            <th className="px-4 py-3">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {filteredItems.map((row) => {
            const isSourceMaterial = isSourceMaterialDiscoveryItem(row);
            const sourceArticleUrl = readMetaText(row.meta, "sourceArticleUrl");
            const autoExtractionError = readMetaText(row.meta, "autoExtractionError");
            const extractionDuplicates = readMetaObjectArray(row.meta, "autoExtractionDuplicates");
            const materialUrl =
              readMetaText(row.meta, "extractedUrl") ||
              (isHttpUrl(row.url) ? row.url : null);

            return (
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
                {isSourceMaterial ? (
                  <div className="mb-1 flex flex-wrap gap-1">
                    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-normal text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                      手机采集素材
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-normal ${
                        readMetaText(row.meta, "autoExtractionStatus") === "failed"
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                          : readMetaText(row.meta, "autoExtractionStatus") === "done"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                      }`}
                    >
                      {sourceMaterialExtractionStatusLabel(row.meta)}
                    </span>
                  </div>
                ) : null}
                {materialUrl && isHttpUrl(materialUrl) ? (
                  <a
                    href={materialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                  >
                    {row.title}
                  </a>
                ) : (
                  <span>{row.title}</span>
                )}
                {sourceArticleUrl && sourceArticleUrl !== materialUrl ? (
                  <p className="mt-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                    来源文章：
                    <a
                      href={sourceArticleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                    >
                      {sourceArticleUrl.length > 56
                        ? `${sourceArticleUrl.slice(0, 56)}…`
                        : sourceArticleUrl}
                    </a>
                  </p>
                ) : null}
                {autoExtractionError ? (
                  <p className="mt-1 max-w-md text-xs font-normal text-red-600 dark:text-red-400">
                    提取失败：{autoExtractionError}
                  </p>
                ) : null}
                {extractionDuplicates.length > 0 ? (
                  <div className="mt-1 max-w-md space-y-0.5 text-xs font-normal text-amber-700 dark:text-amber-300">
                    {extractionDuplicates.slice(0, 3).map((dup) => {
                      const slug = typeof dup.slug === "string" ? dup.slug : "";
                      const name = typeof dup.name === "string" ? dup.name : "";
                      const projectName =
                        typeof dup.projectName === "string" ? dup.projectName : name;
                      return (
                        <p key={`${slug}-${projectName}`}>
                          重复项目：{projectName}
                          {slug ? (
                            <>
                              {" "}
                              (
                              <Link
                                href={`/projects/${slug}`}
                                className="underline underline-offset-2"
                              >
                                {slug}
                              </Link>
                              )
                            </>
                          ) : null}
                        </p>
                      );
                    })}
                    {extractionDuplicates.length > 3 ? (
                      <p>…另有 {extractionDuplicates.length - 3} 个重复项目</p>
                    ) : null}
                  </div>
                ) : null}
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
                    ? "待处理"
                    : row.aiStatus === "done"
                      ? "完成"
                      : row.aiStatus === "failed"
                        ? "失败"
                        : "-"}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`rounded px-2 py-0.5 text-xs ${duplicateBadgeClass(row)}`}>
                  {row.duplicateOfId ? "重复" : row.possibleDuplicate ? "疑似" : "-"}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500 tabular-nums">
                {row.createdAt.replace("T", " ").slice(0, 19)}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {isSourceMaterial ? (
                    <>
                      <span className="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-xs text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
                        原始链接
                      </span>
                      <MobileAutoExtractButton itemId={row.id} />
                    </>
                  ) : row.status === "imported" ? (
                    <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
                      已导入
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={pending || row.status === "rejected"}
                      className={`${btn} ${row.status === "rejected" ? "cursor-not-allowed opacity-50" : ""}`}
                      title={
                        row.status === "rejected"
                          ? "请先标记为新或已处理后再导入"
                          : "写入项目表并回写本队列"
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
                      导入项目
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
                      已处理
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
                      拒绝
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
                      标记为新
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
      )}
    </div>
  );
}
