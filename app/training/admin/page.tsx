import type { Metadata } from "next";

import { TrainingPageShell } from "../_components/training-chrome";
import { listHomework, listRegistrations } from "../lib/store";

export const metadata: Metadata = {
  title: "内部管理 · 实训课数据查看",
  description: "Training 报名与作业记录查看（内部使用）",
  robots: { index: false, follow: false },
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}

export default async function TrainingAdminPage() {
  const [registrations, homework] = await Promise.all([listRegistrations(), listHomework()]);

  return (
    <TrainingPageShell title="内部管理页面" subtitle="仅供华闻传媒研究院与 MUHUB 运营人员查看，请勿对外分享。">
      <div className="mb-6 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
        <strong>⚠ 内部管理页面</strong> — V1 暂未启用权限控制，请勿在生产环境公开此链接。后续版本将接入鉴权。
      </div>

      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            报名记录（{registrations.length}）
          </h2>
        </div>
        {registrations.length === 0 ? (
          <p className="text-sm text-zinc-500">暂无报名记录</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3">提交时间</th>
                  <th className="px-4 py-3">姓名</th>
                  <th className="px-4 py-3">单位</th>
                  <th className="px-4 py-3">职务</th>
                  <th className="px-4 py-3">手机</th>
                  <th className="px-4 py-3">邮箱</th>
                  <th className="px-4 py-3">期次</th>
                  <th className="px-4 py-3">备注</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {registrations.map((row) => (
                  <tr key={row.id} className="bg-white dark:bg-zinc-950">
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{formatTime(row.submittedAt)}</td>
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3">{row.organization}</td>
                    <td className="px-4 py-3">{row.title}</td>
                    <td className="px-4 py-3">{row.phone}</td>
                    <td className="px-4 py-3">{row.email}</td>
                    <td className="px-4 py-3">{row.session}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-zinc-500">{row.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            作业提交（{homework.length}）
          </h2>
        </div>
        {homework.length === 0 ? (
          <p className="text-sm text-zinc-500">暂无作业提交</p>
        ) : (
          <div className="space-y-4">
            {homework.map((row) => (
              <div
                key={row.id}
                className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span>{formatTime(row.submittedAt)}</span>
                  <span>·</span>
                  <span>{row.session}</span>
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{row.homeworkTitle}</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {row.name} · {row.organization} · {row.phone}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {row.homeworkContent}
                </p>
                {row.attachmentUrl ? (
                  <p className="mt-2 text-sm">
                    附件：
                    <a
                      href={row.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 underline underline-offset-2 dark:text-teal-400"
                    >
                      {row.attachmentUrl}
                    </a>
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </TrainingPageShell>
  );
}
