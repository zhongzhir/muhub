import Link from "next/link";
import type { Metadata } from "next";

import { FinalSubmissionForm } from "../_components/final-submission-form";
import { GroupSwitcher } from "../_components/group-switcher";
import { SceneTag, TrainingPageShell } from "../_components/training-chrome";
import { TrainingRecordList, type TrainingRecordListItem } from "../_components/training-record-list";
import { TrainingTaskCard } from "../_components/training-task-card";
import { requireTrainingLogin } from "../lib/auth";
import { getTrainingWorkspace } from "../lib/queries";

export const metadata: Metadata = {
  title: "我的工作台 | 出版融合发展工程实践交流活动",
  description: "记录讨论纪要、阶段成果、导师点评和最终成果。",
  robots: { index: false },
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function formatTime(value: Date): string {
  return value.toLocaleString("zh-CN", { hour12: false });
}

function authorName(record: {
  authorParticipant: {
    displayName: string | null;
    role: string;
    user: { name: string | null; email: string | null; phone: string | null };
  } | null;
}) {
  const author = record.authorParticipant;
  if (!author) return "未知成员";
  return author.displayName || author.user.name || author.user.phone || author.user.email || roleLabel(author.role);
}

function roleLabel(role: string) {
  if (role === "student") return "学员";
  if (role === "mentor") return "导师";
  if (role === "admin") return "管理员";
  return role;
}

export default async function TrainingWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const context = await requireTrainingLogin("/training/workspace");

  if (!context.accessParticipant) {
    return (
      <TrainingPageShell
        title="我的工作台"
        subtitle="请先绑定本次活动身份，绑定后即可进入对应班级和小组工作台。"
      >
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            你已登录，但尚未绑定本次实践交流活动身份。请使用主办方发放的邀请码完成绑定。
          </p>
          <Link
            href="/training/register"
            className="mt-5 inline-flex rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-400"
          >
            绑定活动身份
          </Link>
        </div>
      </TrainingPageShell>
    );
  }

  const workspace = await getTrainingWorkspace(context.accessParticipant);
  const sp = await searchParams;
  const requestedGroupId = sp.groupId;
  const selectedGroup =
    workspace?.groups.find((group) => group.id === requestedGroupId) ?? workspace?.groups[0] ?? null;
  const selectedCase = selectedGroup
    ? workspace?.cases.find((item) => item.classNo === selectedGroup.classNo && item.groupNo === selectedGroup.groupNo)
    : null;
  const selectedRecords =
    selectedGroup && workspace
      ? workspace.records.filter((record) => record.groupId === selectedGroup.id)
      : [];
  const recordsForDisplay: TrainingRecordListItem[] = selectedRecords.map((record) => ({
    id: record.id,
    type: record.type,
    title: record.title,
    content: record.content,
    updatedAt: formatTime(record.updatedAt),
    authorName: authorName(record),
  }));
  const finalRecord = selectedRecords.find((record) => record.type === "final_submission") ?? null;
  const currentRole = context.accessParticipant.role;
  const canWriteStudentRecords = currentRole === "student";
  const canWriteMentorReview = currentRole === "mentor";
  const canWriteFinalSubmission = currentRole === "student";
  const mentors =
    selectedGroup && workspace
      ? workspace.participants.filter((item) => item.role === "mentor" && item.classNo === selectedGroup.classNo)
      : [];

  return (
    <TrainingPageShell
      title="我的工作台"
      subtitle="按小组记录阶段讨论、阶段成果、导师点评和最终成果。"
    >
      {!workspace || !selectedGroup ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          活动数据尚未初始化，请联系工作人员。
        </div>
      ) : (
        <div className="space-y-8">
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <SceneTag tag={roleLabel(currentRole)} />
                  <SceneTag tag={selectedGroup.name} />
                  {selectedCase ? <SceneTag tag={selectedCase.track} /> : null}
                </div>
                <h2 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {selectedCase?.name ?? "小组工作台"}
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {selectedCase ? `${selectedCase.organization} · ${selectedGroup.name}` : selectedGroup.name}
                </p>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
                  本页记录仅在当前小组、负责导师和管理员范围内可见。
                </p>
              </div>
              <GroupSwitcher groups={workspace.groups} selectedGroupId={selectedGroup.id} />
            </div>

            <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                <div className="font-semibold text-zinc-900 dark:text-zinc-50">本组导师</div>
                <div className="mt-2 text-zinc-600 dark:text-zinc-300">
                  {mentors.length
                    ? mentors
                        .map((item) => item.displayName || item.phone || "已绑定导师")
                        .join("、")
                    : "导师信息待绑定"}
                </div>
              </div>
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                <div className="font-semibold text-zinc-900 dark:text-zinc-50">当前记录</div>
                <div className="mt-2 text-zinc-600 dark:text-zinc-300">{selectedRecords.length} 条</div>
              </div>
            </div>
          </section>

          <section className="space-y-5">
            {workspace.tasks.map((task) => (
              <TrainingTaskCard
                key={task.id}
                groupId={selectedGroup.id}
                task={{
                  id: task.id,
                  dayIndex: task.dayIndex,
                  title: task.title,
                  description: task.description,
                  activities: asStringArray(task.activitiesJson),
                  deliverables: asStringArray(task.deliverablesJson),
                }}
                records={recordsForDisplay.filter((record) =>
                  selectedRecords.some((raw) => raw.id === record.id && raw.taskId === task.id),
                )}
                canWriteStudentRecords={canWriteStudentRecords}
                canWriteMentorReview={canWriteMentorReview}
              />
            ))}
          </section>

          <section>
            {canWriteFinalSubmission ? (
              <FinalSubmissionForm
                groupId={selectedGroup.id}
                taskId={workspace.tasks[workspace.tasks.length - 1]?.id}
                initialTitle={finalRecord?.title ?? undefined}
                initialContent={finalRecord?.content ?? undefined}
              />
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <TrainingRecordList
                  title="最终成果"
                  records={recordsForDisplay.filter((record) => record.type === "final_submission")}
                />
              </div>
            )}
          </section>
        </div>
      )}
    </TrainingPageShell>
  );
}
