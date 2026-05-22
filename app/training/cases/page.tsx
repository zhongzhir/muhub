import Link from "next/link";
import type { Metadata } from "next";

import { BRAND, SceneTag, TrainingPageShell } from "../_components/training-chrome";

export const metadata: Metadata = {
  title: "案例学习包 · 数智出版与AI出版实训课系列",
  description: "AI时代项目公众主页建设示例 — MUHUB 实训案例包",
  robots: { index: false },
};

const CASE = {
  name: "AI时代项目公众主页建设示例",
  subject: "MUHUB",
  background:
    "在 AI 与数字化加速渗透出版行业的背景下，项目方需要一套面向公众、可持续更新、便于传播的项目主页。MUHUB 作为 AI 原生项目展示平台，提供了从项目入库、动态更新到对外传播的完整链路，是出版机构学习「AI 时代项目公众主页」建设的典型样本。",
  objectives: [
    "理解 AI 原生项目主页的核心要素：简介、标签、动态、来源可信度",
    "观察 MUHUB 如何将 GitHub / 官网 / 社媒等多源信息聚合到统一主页",
    "分析项目主页在出版行业 AI 工具推广中的传播价值",
    "完成一份「若为本机构 AI 工具做公众主页」的观察报告",
  ],
  materials: [
    { title: "MUHUB 项目主页", href: "/", note: "浏览首页与任意项目详情页" },
    { title: "出版 AI 工具库分类", href: "/projects?category=publishing_media", note: "观察出版类项目如何分类展示" },
    { title: "项目动态与 AI 摘要", href: "/projects", note: "查看项目 Release / 官方动态及 AI 摘要示例" },
  ],
  tasks: [
    "选择一个 MUHUB 上的出版相关项目，截图并标注其主页信息架构",
    "对比该项目在 GitHub（或官网）与 MUHUB 主页的信息差异",
    "列出 3 条「若为本机构 AI 工具建设公众主页」的可落地建议",
  ],
  worksheet: {
    title: "项目主页观察工作表",
    sections: [
      "项目基本信息（名称、定位、目标用户）",
      "主页模块清单（Hero、标签、动态、来源链接等）",
      "信息更新频率与可信度观察",
      "传播场景分析（内部分享 / 对外推广 / 学员教学）",
      "改进建议与可复用模板",
    ],
  },
  reportStructure: [
    "一、案例背景与选择理由",
    "二、MUHUB 项目主页结构分析",
    "三、多源信息聚合观察",
    "四、出版行业应用场景推演",
    "五、本机构可落地建议",
    "六、附录（截图与工作表）",
  ],
};

export default function TrainingCasesPage() {
  return (
    <TrainingPageShell
      title="案例学习包"
      subtitle="当前案例包为示例材料，后续将根据华闻传媒研究院提供的真实案例包更新。"
    >
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: "rgba(201,168,76,0.15)", color: BRAND.gold, border: "1px solid rgba(201,168,76,0.4)" }}
          >
            示例案例
          </span>
          <SceneTag tag={`学习对象：${CASE.subject}`} />
        </div>

        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{CASE.name}</h2>

        <section className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">案例背景</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{CASE.background}</p>
        </section>

        <section className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">学习目标</h3>
          <ul className="mt-3 space-y-2">
            {CASE.objectives.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <span style={{ color: BRAND.gold }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">课程素材</h3>
          <div className="mt-3 space-y-3">
            {CASE.materials.map((m) => (
              <div
                key={m.title}
                className="flex flex-col gap-1 rounded-lg border border-zinc-100 bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-800/50"
              >
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{m.title}</div>
                  <div className="text-xs text-zinc-500">{m.note}</div>
                </div>
                <Link
                  href={m.href}
                  className="text-sm font-medium text-teal-600 hover:underline dark:text-teal-400"
                >
                  打开 →
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">学员任务</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {CASE.tasks.map((task) => (
              <li key={task}>{task}</li>
            ))}
          </ol>
        </section>

        <section className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">工作表</h3>
          <div
            className="mt-3 rounded-xl border p-5"
            style={{ borderColor: "rgba(201,168,76,0.3)", background: "rgba(201,168,76,0.05)" }}
          >
            <div className="font-medium text-zinc-900 dark:text-zinc-100">{CASE.worksheet.title}</div>
            <ul className="mt-3 space-y-1.5">
              {CASE.worksheet.sections.map((s) => (
                <li key={s} className="text-sm text-zinc-600 dark:text-zinc-400">
                  · {s}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-zinc-500">
              工作表可打印或在作业提交页以报告形式填写上述各节内容。
            </p>
          </div>
        </section>

        <section className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">示例报告结构</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {CASE.reportStructure.map((section) => (
              <div
                key={section}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
              >
                {section}
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/training/homework"
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: BRAND.navy }}
          >
            提交本案例作业 →
          </Link>
          <Link
            href="/training/projects"
            className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
          >
            查看更多研究项目
          </Link>
        </div>
      </div>
    </TrainingPageShell>
  );
}
