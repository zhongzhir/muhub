import Link from "next/link";

import { loadAiPipelineStats } from "@/lib/admin-ai-pipeline-stats";

export const dynamic = "force-dynamic";

export default async function AdminAiPipelinePage() {
  const stats = await loadAiPipelineStats();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/admin/system" className="underline underline-offset-2">
            系统后台
          </Link>
          {" / AI Pipeline"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          AI Enrichment Pipeline
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Discovery 自动导入 enrichment 任务、阶段分布与 evidence 覆盖概况。
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["queued", stats.jobs.queued],
          ["success", stats.jobs.success],
          ["failed", stats.jobs.failed],
          ["retrying", stats.jobs.retrying],
          ["infra_failed", stats.jobs.infraFailed],
        ].map(([label, count]) => (
          <div key={label} className="muhub-card p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{count}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="muhub-card p-5">
          <h2 className="text-lg font-semibold">Stage 分布</h2>
          <ul className="mt-3 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
            {Object.entries(stats.stageDistribution).length ? (
              Object.entries(stats.stageDistribution).map(([stage, count]) => (
                <li key={stage} className="flex justify-between">
                  <span>{stage}</span>
                  <span className="tabular-nums">{count}</span>
                </li>
              ))
            ) : (
              <li className="text-zinc-500">暂无 stage 数据</li>
            )}
          </ul>
        </div>

        <div className="muhub-card p-5">
          <h2 className="text-lg font-semibold">
            Coverage 分布（最近 {stats.coverageDistribution.sampled} 个已发布）
          </h2>
          <ul className="mt-3 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
            <li className="flex justify-between">
              <span>github missing</span>
              <span>{stats.coverageDistribution.githubMissing}</span>
            </li>
            <li className="flex justify-between">
              <span>website missing</span>
              <span>{stats.coverageDistribution.websiteMissing}</span>
            </li>
            <li className="flex justify-between">
              <span>low evidence (&lt;45)</span>
              <span>{stats.coverageDistribution.lowEvidence}</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="muhub-card p-5">
        <h2 className="text-lg font-semibold">最近失败 / 重试</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-700">
                <th className="px-2 py-2">项目</th>
                <th className="px-2 py-2">status</th>
                <th className="px-2 py-2">stage</th>
                <th className="px-2 py-2">failureKind</th>
                <th className="px-2 py-2">retry</th>
                <th className="px-2 py-2">error</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentFailures.length ? (
                stats.recentFailures.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="px-2 py-2 font-medium">{row.title}</td>
                    <td className="px-2 py-2">{row.status}</td>
                    <td className="px-2 py-2">{row.stage ?? "-"}</td>
                    <td className="px-2 py-2">{row.failureKind ?? "-"}</td>
                    <td className="px-2 py-2 tabular-nums">{row.retryCount}</td>
                    <td className="max-w-md truncate px-2 py-2 text-zinc-600 dark:text-zinc-400">
                      {row.error ?? "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-zinc-500">
                    暂无失败记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
