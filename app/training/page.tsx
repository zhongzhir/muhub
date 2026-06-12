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
    desc: "查看本组案例、阶段任务、小组成员和导师信息。",
  },
  {
    href: "/training/cases",
    title: "案例资料",
    desc: "按班级和小组查看 6 个实践案例的基础资料。",
  },
  {
    href: "/training/register",
    title: "身份绑定",
    desc: "使用主办方发放的邀请码绑定学员或导师身份。",
  },
  {
    href: "/training/survey",
    title: "满意度调查",
    desc: "活动结束后填写满意度反馈，供主办方复盘使用。",
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
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="max-w-3xl">
            <div
              className="mb-4 inline-flex rounded-full px-3 py-1 text-xs font-medium"
              style={{
                background: "rgba(201,168,76,0.15)",
                color: BRAND.gold,
                border: "1px solid rgba(201,168,76,0.4)",
              }}
            >
              2026 年 6 月 29 日至 7 月 3 日
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
              出版融合发展工程实践交流活动
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/70">
              本工作台用于本期实践交流活动的小组学习、案例资料查看与阶段任务组织。平台按班级和小组隔离资料，优先保障活动期间稳定使用。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/training/workspace"
                className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: BRAND.gold }}
              >
                进入我的工作台
              </Link>
              <Link
                href="/training/register"
                className="rounded-lg border border-white/20 bg-white/10 px-6 py-2.5 text-sm font-medium text-white/85 transition-colors hover:bg-white/15"
              >
                绑定活动身份
              </Link>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {entries.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{entry.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{entry.desc}</p>
            </Link>
          ))}
        </div>

        <section className="mt-10 rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">本期活动结构</h2>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-zinc-500">班级</dt>
              <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">3 个</dd>
            </div>
            <div>
              <dt className="text-zinc-500">学习小组</dt>
              <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">6 个</dd>
            </div>
            <div>
              <dt className="text-zinc-500">实践案例</dt>
              <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">6 个</dd>
            </div>
            <div>
              <dt className="text-zinc-500">阶段任务</dt>
              <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">5 日任务</dd>
            </div>
          </dl>
        </section>
      </main>

      <TrainingFooter />
    </div>
  );
}
