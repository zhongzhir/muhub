import Link from "next/link";
import type { Metadata } from "next";

import { AdminAuthError } from "@/lib/admin-auth";

import { TrainingPageShell } from "../../_components/training-chrome";
import { requireTrainingAdmin } from "../../lib/admin-auth";
import { listTrainingSurveyResponsesForAdmin } from "../../lib/queries";

export const metadata: Metadata = {
  title: "满意度调查结果 | 出版融合发展工程实践交流活动",
  description: "查看本次活动满意度调查结果。",
  robots: { index: false, follow: false },
};

function groupLabel(classNo: number, groupNo: number) {
  if (groupNo <= 0) return `${classNo} 班导师/未分组`;
  return `${classNo} 班 ${groupNo} 组`;
}

function formatTime(value: Date) {
  return value.toLocaleString("zh-CN", { hour12: false });
}

export default async function TrainingAdminSurveyPage() {
  try {
    await requireTrainingAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return (
        <TrainingPageShell title="满意度调查结果" subtitle="仅限 MUHUB 管理员访问。">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            {error.message}
          </div>
        </TrainingPageShell>
      );
    }
    throw error;
  }

  const rows = await listTrainingSurveyResponsesForAdmin();
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.classNo}-${row.groupNo}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  return (
    <TrainingPageShell title="满意度调查结果" subtitle="按班级和小组查看调查评分与文字反馈。">
      <div className="mb-4 flex flex-wrap gap-3">
        <Link href="/training/admin" className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-teal-600 hover:text-teal-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-teal-400 dark:hover:text-teal-300">
          返回管理总览
        </Link>
        <a href="/api/training/admin/survey/export" className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-teal-600 hover:text-teal-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-teal-400 dark:hover:text-teal-300">
          导出调查 CSV
        </a>
      </div>

      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">调查提交总数</div>
        <div className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{rows.length}</div>
      </div>

      <div className="space-y-6">
        {[...groups.entries()].map(([key, bucket]) => (
          <section key={key} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {groupLabel(bucket[0].classNo, bucket[0].groupNo)}
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950">
                  <tr>
                    <th className="px-3 py-2">姓名</th>
                    <th className="px-3 py-2">案例</th>
                    <th className="px-3 py-2">导师</th>
                    <th className="px-3 py-2">平台</th>
                    <th className="px-3 py-2">最有收获</th>
                    <th className="px-3 py-2">最需改进</th>
                    <th className="px-3 py-2">继续参与</th>
                    <th className="px-3 py-2">建议</th>
                    <th className="px-3 py-2">提交时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {bucket.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="px-3 py-3 font-medium text-zinc-900 dark:text-zinc-50">{row.name}</td>
                      <td className="px-3 py-3">{row.caseQualityScore}</td>
                      <td className="px-3 py-3">{row.mentorScore}</td>
                      <td className="px-3 py-3">{row.platformScore}</td>
                      <td className="px-3 py-3 whitespace-pre-wrap">{row.mostValuablePart}</td>
                      <td className="px-3 py-3 whitespace-pre-wrap">{row.improvementPart}</td>
                      <td className="px-3 py-3">{row.willingToContinue ? "愿意" : "暂不考虑"}</td>
                      <td className="px-3 py-3 whitespace-pre-wrap">{row.muhubSuggestion || "-"}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{formatTime(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </TrainingPageShell>
  );
}
