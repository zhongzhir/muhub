import Link from "next/link";
import type { Metadata } from "next";

import { AdminAuthError } from "@/lib/admin-auth";

import { TrainingPageShell } from "../../../_components/training-chrome";
import { requireTrainingAdmin } from "../../../lib/admin-auth";
import { getTrainingAdminGroupDetail } from "../../../lib/queries";

export const metadata: Metadata = {
  title: "小组详情 | 出版融合发展工程实践交流活动",
  description: "查看小组案例、成员、任务记录和文件。",
  robots: { index: false, follow: false },
};

function formatTime(value: Date) {
  return value.toLocaleString("zh-CN", { hour12: false });
}

function personName(item: {
  displayName: string | null;
  user: { name: string | null; email: string | null; phone: string | null };
}) {
  return item.displayName || item.user.name || item.user.phone || item.user.email || "未命名成员";
}

function roleLabel(role: string) {
  if (role === "student") return "学员";
  if (role === "mentor") return "导师";
  if (role === "admin") return "管理员";
  return role;
}

function recordLabel(type: string) {
  if (type === "discussion_note") return "讨论纪要";
  if (type === "task_submission") return "阶段成果";
  if (type === "mentor_review") return "导师点评";
  if (type === "final_submission") return "最终成果";
  return type;
}

function fileSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
  if (sizeBytes >= 1024) return `${Math.ceil(sizeBytes / 1024)} KB`;
  return `${sizeBytes} B`;
}

export default async function TrainingAdminGroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  try {
    await requireTrainingAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return (
        <TrainingPageShell title="小组详情" subtitle="仅限 MUHUB 管理员访问。">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            {error.message}
          </div>
        </TrainingPageShell>
      );
    }
    throw error;
  }

  const { groupId } = await params;
  const data = await getTrainingAdminGroupDetail(groupId);

  if (!data) {
    return (
      <TrainingPageShell title="小组详情" subtitle="未找到对应小组。">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          小组不存在，或活动数据尚未初始化。
        </div>
      </TrainingPageShell>
    );
  }

  return (
    <TrainingPageShell title={`${data.group.name} 详情`} subtitle="只读查看小组案例、成员、任务记录、文件与调查情况。">
      <div className="space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link href="/training/admin/groups" className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-teal-600 hover:text-teal-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-teal-400 dark:hover:text-teal-300">
            返回小组总览
          </Link>
          <a href="/api/training/admin/records/export" className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-teal-600 hover:text-teal-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-teal-400 dark:hover:text-teal-300">
            导出记录 CSV
          </a>
          <a href="/api/training/admin/files/export" className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-teal-600 hover:text-teal-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-teal-400 dark:hover:text-teal-300">
            导出文件 CSV
          </a>
        </div>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">小组与案例</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Info title="小组" content={data.group.name} />
            <Info title="案例" content={data.trainingCase?.name ?? "未配置"} />
            <Info title="案例单位" content={data.trainingCase?.organization ?? "未配置"} />
            <Info title="赛道" content={data.trainingCase?.track ?? "未配置"} />
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">成员与导师</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data.participants.map((participant) => (
              <div key={participant.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
                <div className="font-medium text-zinc-900 dark:text-zinc-50">{personName(participant)}</div>
                <div className="mt-1 text-zinc-500 dark:text-zinc-400">{roleLabel(participant.role)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">任务记录</h2>
          <div className="mt-4 space-y-5">
            {data.tasks.map((task) => {
              const taskRecords = data.records.filter((record) => record.taskId === task.id);
              const taskFiles = data.files.filter((file) => file.taskId === task.id);
              return (
                <article key={task.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{task.title}</h3>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{task.description}</p>

                  <div className="mt-4 space-y-3">
                    {taskRecords.length ? (
                      taskRecords.map((record) => (
                        <div key={record.id} className="rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                          <div className="flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <span>{recordLabel(record.type)}</span>
                            <span>{personName(record.authorParticipant ?? { displayName: null, user: { name: null, email: null, phone: null } })}</span>
                            <span>{formatTime(record.updatedAt)}</span>
                          </div>
                          <div className="mt-2 font-medium text-zinc-900 dark:text-zinc-50">{record.title || "未命名记录"}</div>
                          <div className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{record.content || "-"}</div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">本任务暂无文字记录。</p>
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">文件列表</div>
                    {taskFiles.length ? (
                      <ul className="space-y-2">
                        {taskFiles.map((file) => (
                          <li key={file.id} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="font-medium text-zinc-900 dark:text-zinc-50">{file.originalName}</div>
                              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                {personName(file.uploaderParticipant ?? { displayName: null, user: { name: null, email: null, phone: null } })} · {fileSize(file.sizeBytes)} · {formatTime(file.createdAt)}
                              </div>
                            </div>
                            <a href={`/api/training/files/${file.id}/download`} className="inline-flex rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-teal-600 hover:text-teal-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-teal-400 dark:hover:text-teal-300">
                              下载
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">本任务暂无文件。</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">最终成果与调查</h2>
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <div>
              {data.records.filter((record) => record.type === "final_submission").length ? (
                data.records
                  .filter((record) => record.type === "final_submission")
                  .map((record) => (
                    <div key={record.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
                      <div className="font-medium text-zinc-900 dark:text-zinc-50">{record.title || "最终成果"}</div>
                      <div className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{record.content || "-"}</div>
                    </div>
                  ))
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">暂无单独的最终成果记录。</p>
              )}
            </div>
            <div className="space-y-3">
              {data.surveys.length ? (
                data.surveys.map((survey) => (
                  <div key={survey.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">{survey.name}</div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      案例 {survey.caseQualityScore} 分 / 导师 {survey.mentorScore} 分 / 平台 {survey.platformScore} 分
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                      最有收获：{survey.mostValuablePart}
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                      最需改进：{survey.improvementPart}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">本组尚无调查提交。</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </TrainingPageShell>
  );
}

function Info({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="text-sm text-zinc-500 dark:text-zinc-400">{title}</div>
      <div className="mt-2 font-medium text-zinc-900 dark:text-zinc-50">{content}</div>
    </div>
  );
}
