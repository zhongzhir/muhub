import Link from "next/link";
import type { Metadata } from "next";

import { AdminAuthError } from "@/lib/admin-auth";

import { TrainingPageShell } from "../_components/training-chrome";
import { requireTrainingAdmin } from "../lib/admin-auth";
import { getTrainingAdminOverview } from "../lib/queries";

export const metadata: Metadata = {
  title: "Training 管理总览 | 出版融合发展工程实践交流活动",
  description: "查看实践交流活动各小组记录数量。",
  robots: { index: false, follow: false },
};

export default async function TrainingAdminPage() {
  try {
    await requireTrainingAdmin();
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

  const overview = await getTrainingAdminOverview();
  const event = overview?.event ?? null;
  const groups = overview?.groups ?? [];
  const cases = overview?.cases ?? [];
  const counts = overview?.recordCounts ?? [];
  const fileCounts = overview?.fileCounts ?? [];
  const surveyCounts = overview?.surveyCounts ?? [];

  function countFor(groupId: string, type?: string) {
    return counts
      .filter((item) => item.groupId === groupId && (!type || item.type === type))
      .reduce((sum, item) => sum + item._count._all, 0);
  }

  function fileCountFor(groupId: string) {
    return fileCounts
      .filter((item) => item.groupId === groupId)
      .reduce((sum, item) => sum + item._count._all, 0);
  }

  function surveyCountFor(group: { classNo: number; groupNo: number }) {
    return surveyCounts
      .filter((item) => item.classNo === group.classNo && item.groupNo === group.groupNo)
      .reduce((sum, item) => sum + item._count._all, 0);
  }

  const totalSurveyCount = surveyCounts.reduce((sum, item) => sum + item._count._all, 0);

  return (
    <TrainingPageShell title="Training 管理总览" subtitle="只读查看各小组工作台记录数量。">
      {!event ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          活动数据尚未初始化。
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <CardStat label="小组数" value={`${groups.length}`} />
            <CardStat label="案例数" value={`${cases.length}`} />
            <CardStat label="调查提交数" value={`${totalSurveyCount}`} />
            <CardStat
              label="导出入口"
              value="CSV"
              href="/training/admin/survey"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/training/admin/groups" className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-teal-600 hover:text-teal-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-teal-400 dark:hover:text-teal-300">
              查看小组详情
            </Link>
            <Link href="/training/admin/survey" className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-teal-600 hover:text-teal-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-teal-400 dark:hover:text-teal-300">
              查看调查结果
            </Link>
            <a href="/api/training/admin/survey/export" className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-teal-600 hover:text-teal-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-teal-400 dark:hover:text-teal-300">
              导出调查 CSV
            </a>
            <a href="/api/training/admin/records/export" className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-teal-600 hover:text-teal-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-teal-400 dark:hover:text-teal-300">
              导出记录 CSV
            </a>
            <a href="/api/training/admin/files/export" className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-teal-600 hover:text-teal-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-teal-400 dark:hover:text-teal-300">
              导出文件 CSV
            </a>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950">
                <tr>
                  <th className="px-4 py-3">小组</th>
                  <th className="px-4 py-3">讨论纪要</th>
                  <th className="px-4 py-3">阶段成果</th>
                  <th className="px-4 py-3">导师点评</th>
                  <th className="px-4 py-3">最终成果</th>
                  <th className="px-4 py-3">文件</th>
                  <th className="px-4 py-3">调查</th>
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
                    <td className="px-4 py-3">{fileCountFor(group.id)}</td>
                    <td className="px-4 py-3">{surveyCountFor(group)}</td>
                    <td className="px-4 py-3">{countFor(group.id)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/training/admin/groups/${group.id}`}
                        className="text-teal-700 underline underline-offset-2 dark:text-teal-300"
                      >
                        查看小组详情
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </TrainingPageShell>
  );
}

function CardStat({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="text-sm text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-teal-600 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-teal-400">
        {content}
      </Link>
    );
  }

  return <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">{content}</div>;
}
