import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { RunDiscoveryBar } from "../run-discovery-bar";

export const dynamic = "force-dynamic";

export default async function AdminDiscoveryTasksPage() {
  const [sources, recentRuns] = await Promise.all([
    prisma.discoverySource.findMany({
      select: { id: true, key: true, name: true, status: true, lastSuccessAt: true, lastErrorAt: true },
      orderBy: { key: "asc" },
      take: 20,
    }),
    prisma.discoveryRun.findMany({
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        newCandidateCount: true,
        updatedCandidateCount: true,
        fetchedCount: true,
        source: { select: { name: true, key: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/discovery" className="underline-offset-4 hover:underline">
          ← 候选列表
        </Link>
      </p>

      <section className="muhub-card space-y-3 p-6">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">抓取与任务</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">轻量工作台：集中查看抓取入口、补全入口和最近任务概览。</p>
        <RunDiscoveryBar />
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="font-medium text-zinc-800 dark:text-zinc-200">补全入口</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            候选列表支持批量补全与批量分类，JSON 队列支持内容管线运行。
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/admin/discovery" className="muhub-btn-secondary px-3 py-2 text-xs">
              打开候选列表
            </Link>
            <Link href="/admin/discovery/items" className="muhub-btn-secondary px-3 py-2 text-xs">
              打开 JSON 队列
            </Link>
          </div>
        </div>
      </section>

      <section className="muhub-card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">最近任务概览</h2>
        {recentRuns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
            暂无任务记录，先执行一次抓取后这里会展示最近运行摘要。
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900/70">
                <tr>
                  <th className="px-3 py-2">来源</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">抓取/新增/更新</th>
                  <th className="px-3 py-2">开始</th>
                  <th className="px-3 py-2">结束</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-3 py-2">
                      <p>{run.source.name}</p>
                      <p className="text-xs text-zinc-500">{run.source.key}</p>
                    </td>
                    <td className="px-3 py-2">{run.status}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {run.fetchedCount} / {run.newCandidateCount} / {run.updatedCandidateCount}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-500">{run.startedAt.toISOString().replace("T", " ").slice(0, 19)}</td>
                    <td className="px-3 py-2 text-xs text-zinc-500">{run.finishedAt ? run.finishedAt.toISOString().replace("T", " ").slice(0, 19) : "运行中"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="muhub-card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">来源状态</h2>
        {sources.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">暂无来源配置。</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {sources.map((source) => (
              <li key={source.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{source.name}</p>
                <p className="text-xs text-zinc-500">{source.key}</p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {source.status} · 最近成功 {source.lastSuccessAt ? source.lastSuccessAt.toISOString().slice(0, 10) : "—"} · 最近失败 {source.lastErrorAt ? source.lastErrorAt.toISOString().slice(0, 10) : "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="muhub-card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">相关入口</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
          <li>
            <Link href="/admin/discovery" className="text-blue-600 underline dark:text-blue-400">
              候选列表
            </Link>
            — 顶部运行栏与筛选
          </li>
          <li>
            <Link href="/admin/discovery/items" className="text-blue-600 underline dark:text-blue-400">
              JSON 队列
            </Link>
            — 内容管线与批量任务
          </li>
          <li>
            <Link href="/admin/discovery/sources" className="text-blue-600 underline dark:text-blue-400">
              来源管理
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
