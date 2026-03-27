import type { Metadata } from "next";
import Link from "next/link";
import { BetaTrustStrip } from "@/components/home/beta-trust-strip";
import { SITE_NAME_ZH, SITE_NAME_EN } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "反馈与建议",
  description: `向 ${SITE_NAME_ZH} ${SITE_NAME_EN} Beta 提交产品反馈与改进建议。`,
};

export default function FeedbackPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
        </p>

        <header className="mt-8">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            反馈与建议
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            木哈布 MUHUB 当前处于 Beta
            阶段。若你在试用中遇到 bug、功能缺口或有产品想法，我们非常感谢你能抽出时间告诉我们。
          </p>
        </header>

        <section className="mt-10" aria-labelledby="feedback-how-heading">
          <h2 id="feedback-how-heading" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            你可以这样反馈
          </h2>
          <ul className="mt-4 list-inside list-disc space-y-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            <li>
              <strong className="font-medium text-zinc-700 dark:text-zinc-300">邮件（占位）</strong>
              ：正式支持邮箱上线后将更新在本页；此前可优先通过下方公开仓库 Issue 留言。
            </li>
            <li>
              <strong className="font-medium text-zinc-700 dark:text-zinc-300">GitHub Issue（占位）</strong>
              ：若仓库已公开，可通过 Issue / Discussions
              提交可复现步骤与期望行为；链接待运营侧同步至此页。
            </li>
            <li>
              <strong className="font-medium text-zinc-700 dark:text-zinc-300">产品内路径</strong>
              ：创建或编辑项目时遇到流程问题，可一并写在反馈里，便于我们对照场景迭代。
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">希望展示项目？</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            在木哈布创建项目并标记为公开，即可进入项目广场供浏览。
            <Link
              href="/dashboard/projects/new"
              className="ml-1 font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
            >
              前往创建项目
            </Link>
          </p>
        </section>

        <div className="mt-12">
          <BetaTrustStrip />
        </div>
      </div>
    </div>
  );
}
