import Link from "next/link";
import { notFound } from "next/navigation";
import { buildProjectUpdateStreamModel } from "@/lib/project-updates";
import { readProjectActionLogs } from "@/lib/project-action-log";
import { prisma } from "@/lib/prisma";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";

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

export default async function AdminProjectActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.project.findFirst({
    where: { id, ...PROJECT_ACTIVE_FILTER },
    select: { id: true, name: true, slug: true },
  });
  if (!row) {
    notFound();
  }
  const updates = await prisma.projectUpdate.findMany({
    where: { projectId: row.id },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 12,
    select: {
      id: true,
      sourceType: true,
      sourceLabel: true,
      isAiGenerated: true,
      title: true,
      summary: true,
      sourceUrl: true,
      occurredAt: true,
      createdAt: true,
    },
  });
  const actionLogs = await readProjectActionLogs(row.id, 30);

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
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">项目动态</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          项目：{row.name}
          <span className="ml-2 font-mono text-xs text-zinc-500">({row.slug})</span>
        </p>

        <div className="flex flex-wrap gap-2">
          <button type="button" disabled className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700">
            新增动态（预留）
          </button>
          <Link href={`/admin/marketing?projectId=${encodeURIComponent(row.id)}`} className="muhub-btn-secondary px-3 py-2 text-sm">
            去营销中心
          </Link>
        </div>

        {updates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40">
            暂无 ProjectUpdate，后续可在此统一查看人工更新、抓取更新与系统事件。
          </div>
        ) : (
          <ul className="space-y-3">
            {updates.map((item) => {
              const model = buildProjectUpdateStreamModel(item);
              const when = item.occurredAt ?? item.createdAt;
              return (
                <li key={item.id} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={model.badgeClass}>{model.primaryLabel}</span>
                    {model.aiAugment ? <span className={model.aiAugment.className}>{model.aiAugment.label}</span> : null}
                    <span className="text-xs text-zinc-500">{when.toISOString().replace("T", " ").slice(0, 19)}</span>
                  </div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p>
                  {item.summary ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{item.summary}</p> : null}
                  {item.sourceUrl ? (
                    <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
                      查看来源
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="muhub-card space-y-4 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">项目操作日志</h2>
        {actionLogs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
            暂无操作日志。
          </div>
        ) : (
          <ul className="space-y-2">
            {actionLogs.map((item) => (
              <li key={item.id} className="rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {actionLabel(item.action)}
                  </span>
                  <span className="text-xs text-zinc-500">{item.occurredAt.toISOString().replace("T", " ").slice(0, 19)}</span>
                </div>
                {item.detail ? <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{item.detail}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
