import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";

export const dynamic = "force-dynamic";

export default async function AdminProjectsListPage() {
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
        未配置 DATABASE_URL，无法加载项目列表。
      </div>
    );
  }

  const rows = await prisma.project.findMany({
    where: PROJECT_ACTIVE_FILTER,
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      visibilityStatus: true,
      isPublic: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">
            <Link href="/admin" className="underline-offset-4 hover:underline">
              ← 后台总览
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">项目列表</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">正式项目维护入口；收录自 Discovery 后在此编辑与发布。</p>
        </div>
        <Link href="/admin/projects/quality" className="muhub-btn-secondary px-3 py-2 text-sm">
          质量看板
        </Link>
      </header>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/80">
            <tr>
              <th className="px-4 py-3">项目名称</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">可见性</th>
              <th className="px-4 py-3">公开</th>
              <th className="px-4 py-3">更新时间</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  暂无项目
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60">
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{r.name}</td>
                  <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">{r.status}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{r.visibilityStatus}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{r.isPublic ? "是" : "否"}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{r.updatedAt.toISOString().replace("T", " ").slice(0, 19)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/admin/projects/${r.id}/edit`} className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
                        编辑
                      </Link>
                      <Link
                        href={`/admin/marketing?projectId=${encodeURIComponent(r.id)}`}
                        className="text-violet-600 underline-offset-2 hover:underline dark:text-violet-400"
                      >
                        营销中心
                      </Link>
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
