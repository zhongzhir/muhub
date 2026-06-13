import Link from "next/link";
import type { Metadata } from "next";

import { BRAND, TrainingFooter, TrainingHeader, TrainingNav } from "./_components/training-chrome";

export const metadata: Metadata = {
  title: "出版融合发展工程实践交流活动 | MUHUB Training",
  description: "2026 年 6 月 29 日至 7 月 3 日出版融合发展工程实践交流活动专项工作台。",
  robots: { index: false },
};

const entries = [
  {
    href: "/training/workspace",
    title: "我的工作台",
    desc: "查看本组案例、阶段任务、讨论纪要、成果记录与导师点评。",
  },
  {
    href: "/training/cases",
    title: "案例资料",
    desc: "查看本次实践交流活动对应的 6 个案例基础资料。",
  },
  {
    href: "/training/register",
    title: "身份绑定",
    desc: "使用邀请码绑定学员或导师身份，进入对应班级与小组。",
  },
  {
    href: "/training/survey",
    title: "满意度调查",
    desc: "活动结束后填写反馈意见，供主办方复盘改进。",
  },
];

export default function TrainingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <TrainingHeader />
      <TrainingNav />

      <section
        className="border-b border-zinc-200 dark:border-zinc-800"
        style={{ background: `linear-gradient(160deg, ${BRAND.navy} 0%, #243050 100%)` }}
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-4xl">
            <div
              className="inline-flex rounded-full px-3 py-1 text-xs font-medium"
              style={{
                background: "rgba(201,168,76,0.15)",
                color: BRAND.gold,
                border: "1px solid rgba(201,168,76,0.4)",
              }}
            >
              2026 年 6 月 29 日至 7 月 3 日
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              出版融合发展工程实践交流活动
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/72 sm:text-lg">
              本平台用于本期实践交流活动的小组学习、案例资料查阅、阶段任务记录、成果提交与活动反馈。
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {entries.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="group flex min-h-[176px] flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
            >
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{entry.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{entry.desc}</p>
              </div>
              <div className="mt-6 text-sm font-medium text-zinc-900 transition-colors group-hover:text-zinc-700 dark:text-zinc-100 dark:group-hover:text-zinc-200">
                查看入口
              </div>
            </Link>
          ))}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="max-w-xl">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">活动概览</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                本期实践交流活动以小组为基本学习单位，围绕案例研读、任务推进、成果研磨与复盘反馈组织现场学习过程。
              </p>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DataStat label="班级" value="3 个" />
              <DataStat label="学习小组" value="6 个" />
              <DataStat label="实践案例" value="6 个" />
              <DataStat label="阶段任务" value="5 日任务" />
            </dl>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="max-w-xl">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                拓展学习：MUHUB 出版与传媒项目
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                浏览 MUHUB 平台已收录的出版与传媒相关项目，作为案例分析、行业观察和 AI 辅助研究的补充材料。
              </p>
            </div>
            <div className="mt-6">
              <a
                href="https://www.muhub.cn/projects?category=publishing_media"
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-lg border border-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-900 hover:text-white dark:border-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-100 dark:hover:text-zinc-900"
              >
                查看 MUHUB 出版与传媒项目
              </a>
            </div>
          </div>
        </section>
      </main>

      <TrainingFooter />
    </div>
  );
}

function DataStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <dt className="text-sm text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{value}</dd>
    </div>
  );
}
