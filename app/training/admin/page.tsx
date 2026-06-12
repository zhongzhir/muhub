import Link from "next/link";
import type { Metadata } from "next";

import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

import { TrainingPageShell } from "../_components/training-chrome";
import { TRAINING_2026_EVENT_SLUG } from "../lib/current-event";

export const metadata: Metadata = {
  title: "Training 管理总览 | 出版融合发展工程实践交流活动",
  description: "查看实践交流活动各小组记录数量。",
  robots: { index: false, follow: false },
};

export default async function TrainingAdminPage() {
  try {
    await requireMuHubAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return (
        <TrainingPageShell title="Training 管理总览" subtitle="仅限 MUHUB 管理员访问。">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            {error.message}
          </div>
        </TrainingPageShell>
      );
    }
    throw error;
  }

  const event = await prisma.trainingEvent.findUnique({
    where: { slug: TRAINING_2026_EVENT_SLUG },
  });
  const groups = event
    ? await prisma.trainingGroup.findMany({
        where: { eventId: event.id },
        orderBy: [{ classNo: "asc" }, { groupNo: "asc" }],
      })
    : [];
  const counts = event
    ? await prisma.trainingRecord.groupBy({
        by: ["groupId", "type"],
        where: { eventId: event.id },
        _count: { _all: true },
      })
    : [];

  function countFor(groupId: string, type?: string) {
    return counts
      .filter((item) => item.groupId === groupId && (!type || item.type === type))
      .reduce((sum, item) => sum + item._count._all, 0);
  }

  return (
    <TrainingPageShell title="Training 管理总览" subtitle="只读查看各小组工作台记录数量。">
      {!event ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          活动数据尚未初始化。
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950">
              <tr>
                <th className="px-4 py-3">小组</th>
                <th className="px-4 py-3">讨论纪要</th>
                <th className="px-4 py-3">阶段成果</th>
                <th className="px-4 py-3">导师点评</th>
                <th className="px-4 py-3">最终成果</th>
                <th className="px-4 py-3">全部记录</th>
                <th className="px-4 py-3">查看</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {groups.map((group) => (
                <tr key={group.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{group.name}</td>
                  <td className="px-4 py-3">{countFor(group.id, "discussion_note")}</td>
                  <td className="px-4 py-3">{countFor(group.id, "task_submission")}</td>
                  <td className="px-4 py-3">{countFor(group.id, "mentor_review")}</td>
                  <td className="px-4 py-3">{countFor(group.id, "final_submission")}</td>
                  <td className="px-4 py-3">{countFor(group.id)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/training/workspace?groupId=${group.id}`}
                      className="text-teal-700 underline underline-offset-2 dark:text-teal-300"
                    >
                      查看工作台
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TrainingPageShell>
  );
}
