import Link from "next/link";
import type { DiscoverySignalStatus, Prisma } from "@prisma/client";
import { getDiscoverySignalPriority } from "@/lib/discovery/signal-priority";
import { getDiscoverySignalSourceStats } from "@/lib/discovery/signal-source-stats";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type PriorityFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW";

const STATUS_TABS: Array<{ label: string; value: "ALL" | DiscoverySignalStatus }> = [
  { label: "全部", value: "ALL" },
  { label: "PENDING", value: "PENDING" },
  { label: "REVIEWED", value: "REVIEWED" },
  { label: "CONVERTED", value: "CONVERTED" },
  { label: "REJECTED", value: "REJECTED" },
];
const PRIORITY_TABS: Array<{ label: string; value: PriorityFilter }> = [
  { label: "全部优先级", value: "ALL" },
  { label: "HIGH", value: "HIGH" },
  { label: "MEDIUM", value: "MEDIUM" },
  { label: "LOW", value: "LOW" },
];
const SOURCE_TABS: Array<{ label: string; value: "ALL" | "MULTI" }> = [
  { label: "全部来源", value: "ALL" },
  { label: "多来源优先", value: "MULTI" },
];

function statusBadgeClass(status: DiscoverySignalStatus): string {
  if (status === "PENDING") {
    return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }
  if (status === "REVIEWED") {
    return "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200";
  }
  if (status === "CONVERTED") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
  return "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200";
}

function priorityBadgeClass(priority: "HIGH" | "MEDIUM" | "LOW"): string {
  if (priority === "HIGH") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
  if (priority === "MEDIUM") {
    return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }
  return "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300";
}

function buildSignalsHref(input: {
  status: "ALL" | DiscoverySignalStatus;
  q: string;
  priority: PriorityFilter;
  multiSourceOnly: boolean;
}): string {
  const params = new URLSearchParams();
  if (input.status !== "ALL") {
    params.set("status", input.status);
  }
  if (input.q) {
    params.set("q", input.q);
  }
  if (input.priority !== "ALL") {
    params.set("priority", input.priority);
  }
  if (input.multiSourceOnly) {
    params.set("multiSource", "true");
  }
  return `/admin/discovery/signals${params.toString() ? `?${params.toString()}` : ""}`;
}

export default async function AdminDiscoverySignalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const statusRaw = typeof sp.status === "string" ? sp.status.toUpperCase() : "ALL";
  const priorityRaw = typeof sp.priority === "string" ? sp.priority.toUpperCase() : "ALL";
  const multiSourceRaw =
    typeof sp.multiSource === "string" ? sp.multiSource.toLowerCase() : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status =
    statusRaw === "PENDING" ||
    statusRaw === "REVIEWED" ||
    statusRaw === "CONVERTED" ||
    statusRaw === "REJECTED"
      ? statusRaw
      : "ALL";
  const priority: PriorityFilter =
    priorityRaw === "HIGH" || priorityRaw === "MEDIUM" || priorityRaw === "LOW"
      ? priorityRaw
      : "ALL";
  const multiSourceOnly = multiSourceRaw === "true";

  const where: Prisma.DiscoverySignalWhereInput = {
    ...(status !== "ALL" ? { status } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { guessedProjectName: { contains: q, mode: "insensitive" } },
            { sourceName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const fetchedRows = await prisma.discoverySignal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 400,
    select: {
      id: true,
      title: true,
      sourceType: true,
      sourceName: true,
      url: true,
      guessedProjectName: true,
      guessedWebsiteUrl: true,
      guessedGithubUrl: true,
      summary: true,
      referenceSources: true,
      status: true,
      createdAt: true,
    },
  });
  const rows = fetchedRows
    .map((row) => {
      const sourceStats = getDiscoverySignalSourceStats(row.referenceSources);
      const priorityResult = getDiscoverySignalPriority({
        sourceType: row.sourceType,
        title: row.title,
        summary: row.summary,
        guessedProjectName: row.guessedProjectName,
        guessedWebsiteUrl: row.guessedWebsiteUrl,
        guessedGithubUrl: row.guessedGithubUrl,
        referenceSources: row.referenceSources,
      });
      return { ...row, sourceStats, priorityResult };
    })
    .filter((row) => {
      if (priority !== "ALL" && row.priorityResult.priority !== priority) {
        return false;
      }
      if (multiSourceOnly && !row.sourceStats.isMultiSource) {
        return false;
      }
      return true;
    });

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/discovery" className="underline">
          ← 候选列表
        </Link>
      </p>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">线索池 / Signals</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          NEWS / SOCIAL / BLOG 等非结构化线索先进入信号池，再人工转为候选项目。
        </p>
      </header>
      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">状态筛选</span>
          {STATUS_TABS.map((tab) => {
            const href = buildSignalsHref({
              status: tab.value,
              q,
              priority,
              multiSourceOnly,
            });
            const active = status === tab.value;
            return (
              <Link
                key={tab.value}
                href={href}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-zinc-500">优先级筛选</span>
          {PRIORITY_TABS.map((tab) => {
            const href = buildSignalsHref({
              status,
              q,
              priority: tab.value,
              multiSourceOnly,
            });
            const active = priority === tab.value;
            return (
              <Link
                key={tab.value}
                href={href}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-zinc-500">来源筛选</span>
          {SOURCE_TABS.map((tab) => {
            const nextMulti = tab.value === "MULTI";
            const href = buildSignalsHref({
              status,
              q,
              priority,
              multiSourceOnly: nextMulti,
            });
            const active = multiSourceOnly === nextMulti;
            return (
              <Link
                key={tab.value}
                href={href}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
          当前筛选：
          <span className="ml-2">状态：{status}</span>
          <span className="ml-3">优先级：{priority}</span>
          <span className="ml-3">来源：{multiSourceOnly ? "多来源优先" : "全部来源"}</span>
          <span className="ml-3">关键词：{q || "（无）"}</span>
        </div>
        <form method="get" className="flex max-w-lg gap-2">
          {status !== "ALL" ? <input type="hidden" name="status" value={status} /> : null}
          {priority !== "ALL" ? <input type="hidden" name="priority" value={priority} /> : null}
          {multiSourceOnly ? <input type="hidden" name="multiSource" value="true" /> : null}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="搜索标题 / 推断项目名 / 来源名称"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
          >
            搜索
          </button>
        </form>
      </section>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">标题</th>
              <th className="px-3 py-2">来源类型</th>
              <th className="px-3 py-2">来源名称</th>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">推断项目名</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">优先级</th>
              <th className="px-3 py-2">来源数</th>
              <th className="px-3 py-2">创建时间</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                  暂无线索数据。
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                return (
                  <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-800/80">
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/discovery/signals/${row.id}`}
                        className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{row.sourceType}</td>
                    <td className="px-3 py-2">{row.sourceName}</td>
                    <td className="max-w-[280px] truncate px-3 py-2">
                      <a href={row.url} target="_blank" rel="noreferrer" className="text-blue-600 underline dark:text-blue-400">
                        {row.url}
                      </a>
                    </td>
                    <td className="px-3 py-2">{row.guessedProjectName || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${priorityBadgeClass(row.priorityResult.priority)}`}>
                        {row.priorityResult.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300">
                      {row.sourceStats.total} 来源
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {row.createdAt.toISOString().replace("T", " ").slice(0, 19)}
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
