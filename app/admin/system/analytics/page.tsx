import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export default async function AdminSystemAnalyticsPage() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    recentUsers,
    totalProjects,
    publishedProjects,
    draftReadyProjects,
    totalCandidates,
    totalSignals,
    pendingSignals,
    convertedSignals,
    totalProjectUpdates,
    totalActionLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.project.count({ where: { deletedAt: null } }),
    prisma.project.count({ where: { deletedAt: null, status: "PUBLISHED" } }),
    prisma.project.count({
      where: { deletedAt: null, status: { in: ["DRAFT", "READY"] } },
    }),
    prisma.discoveryCandidate.count(),
    prisma.discoverySignal.count(),
    prisma.discoverySignal.count({ where: { status: "PENDING" } }),
    prisma.discoverySignal.count({ where: { status: "CONVERTED" } }),
    prisma.projectUpdate.count(),
    prisma.projectUpdate.count({ where: { sourceLabel: "project-action-log" } }),
  ]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/system" className="underline">
          ← 系统首页
        </Link>
      </p>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          数据概览
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          最小平台运营统计，不引入图表库，仅做卡片级数据展示。
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">用户</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <StatCard label="用户总数" value={totalUsers} />
          <StatCard label="最近 7 天新增" value={recentUsers} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">项目</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <StatCard label="项目总数" value={totalProjects} />
          <StatCard label="已发布项目数" value={publishedProjects} />
          <StatCard label="DRAFT/READY 项目数" value={draftReadyProjects} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Discovery</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="DiscoveryCandidate 总数" value={totalCandidates} />
          <StatCard label="DiscoverySignal 总数" value={totalSignals} />
          <StatCard label="待处理 Signal（PENDING）" value={pendingSignals} />
          <StatCard label="已转候选 Signal（CONVERTED）" value={convertedSignals} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">运营</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <StatCard label="ProjectUpdate 总数" value={totalProjectUpdates} />
          <StatCard
            label="操作日志总数"
            value={totalActionLogs}
            hint="按 sourceLabel=project-action-log 统计"
          />
        </div>
      </section>
    </div>
  );
}
