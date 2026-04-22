import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchAdminProjectForEdit } from "@/lib/admin-project-edit";
import { readProjectActionLogs } from "@/lib/project-action-log";
import { prisma } from "@/lib/prisma";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { PublishActionsForm } from "./publish-actions-form";

export const dynamic = "force-dynamic";

function actionLabel(action: string): string {
  if (action === "save") return "保存草稿";
  if (action === "publish") return "发布项目";
  if (action === "hide") return "隐藏/取消公开";
  if (action === "archive") return "归档";
  if (action === "import") return "Discovery 收录";
  if (action === "marketing_generate") return "营销生成";
  return action;
}

export default async function AdminProjectPublishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row, editState, recentLogs] = await Promise.all([
    prisma.project.findFirst({
      where: { id, ...PROJECT_ACTIVE_FILTER },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        visibilityStatus: true,
        isPublic: true,
        publishedAt: true,
      },
    }),
    fetchAdminProjectForEdit(id),
    readProjectActionLogs(id, 3),
  ]);
  if (!row) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/projects" className="underline-offset-4 hover:underline">
          ← 项目列表
        </Link>
        {" · "}
        <Link href={`/admin/projects/${row.id}/edit`} className="underline-offset-4 hover:underline">
          编辑项目
        </Link>
      </p>
      <section className="muhub-card space-y-4 p-6">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">发布与可见性</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          当前项目：<span className="font-medium">{row.name}</span>
          <span className="ml-2 font-mono text-xs text-zinc-500">({row.slug})</span>
        </p>

        <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900/50 sm:grid-cols-2">
          <div>
            当前状态：
            <code className="ml-1 rounded bg-zinc-100 px-1 dark:bg-zinc-800">{row.status}</code>
          </div>
          <div>
            当前可见性：
            <code className="ml-1 rounded bg-zinc-100 px-1 dark:bg-zinc-800">{row.visibilityStatus}</code>
          </div>
          <div>是否公开：{row.isPublic ? "是" : "否"}</div>
          <div>发布时间：{row.publishedAt ? row.publishedAt.toISOString().replace("T", " ").slice(0, 19) : "未发布"}</div>
        </div>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/30">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">发布检查摘要</h2>
          {editState?.readinessMessages?.length ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {editState.readinessMessages.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">当前资料满足基础发布要求。</p>
          )}
        </section>

        <PublishActionsForm projectId={row.id} canArchive={row.status !== "ARCHIVED"} />

        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/30">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">最近操作日志</h2>
          {recentLogs.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">暂无日志。</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {recentLogs.map((item) => (
                <li key={item.id}>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{actionLabel(item.action)}</span>
                  {" · "}
                  {item.occurredAt.toISOString().replace("T", " ").slice(0, 19)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/projects/${row.id}/activity`} className="muhub-btn-secondary px-3 py-2 text-sm">
            项目动态
          </Link>
          <Link href={`/admin/marketing?projectId=${encodeURIComponent(row.id)}`} className="muhub-btn-secondary px-3 py-2 text-sm">
            营销中心
          </Link>
          {row.status === "PUBLISHED" ? (
            <Link href={`/projects/${row.slug}`} target="_blank" className="muhub-btn-secondary px-3 py-2 text-sm">
              查看前台页
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
