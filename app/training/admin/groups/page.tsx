import Link from "next/link";
import type { Metadata } from "next";

import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";

import { TrainingPageShell } from "../../_components/training-chrome";
import { listTrainingAdminGroups } from "../../lib/queries";

export const metadata: Metadata = {
  title: "小组详情总览 | 出版融合发展工程实践交流活动",
  description: "查看各小组只读详情入口。",
  robots: { index: false, follow: false },
};

export default async function TrainingAdminGroupsPage() {
  try {
    await requireMuHubAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return (
        <TrainingPageShell title="小组详情总览" subtitle="仅限 MUHUB 管理员访问。">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            {error.message}
          </div>
        </TrainingPageShell>
      );
    }
    throw error;
  }

  const data = await listTrainingAdminGroups();

  return (
    <TrainingPageShell title="小组详情总览" subtitle="进入各小组只读详情页查看案例、成员、记录和文件。">
      {!data ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          活动数据尚未初始化。
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Link href="/training/admin" className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-teal-600 hover:text-teal-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-teal-400 dark:hover:text-teal-300">
              返回管理总览
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.groups.map((group) => {
              const trainingCase =
                data.cases.find((item) => item.classNo === group.classNo && item.groupNo === group.groupNo) ?? null;
              const memberCount = data.participants.filter(
                (item) => item.role === "student" && item.classNo === group.classNo && item.groupNo === group.groupNo,
              ).length;
              const recordCount =
                data.recordCounts.find((item) => item.groupId === group.id)?._count._all ?? 0;
              const fileCount = data.fileCounts.find((item) => item.groupId === group.id)?._count._all ?? 0;
              const surveyCount =
                data.surveyCounts.find((item) => item.classNo === group.classNo && item.groupNo === group.groupNo)?._count
                  ._all ?? 0;

              return (
                <div key={group.id} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">{group.name}</div>
                  <h2 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {trainingCase?.name ?? "案例待配置"}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {trainingCase?.organization ?? "未配置案例单位"}
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <Stat label="成员" value={`${memberCount}`} />
                    <Stat label="记录" value={`${recordCount}`} />
                    <Stat label="文件" value={`${fileCount}`} />
                  </div>
                  <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">调查提交：{surveyCount}</div>
                  <Link
                    href={`/training/admin/groups/${group.id}`}
                    className="mt-4 inline-flex rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:border-teal-600 hover:text-teal-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-teal-400 dark:hover:text-teal-300"
                  >
                    查看小组详情
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </TrainingPageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">{value}</div>
    </div>
  );
}
