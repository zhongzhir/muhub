import Link from "next/link";
import type { Metadata } from "next";

import { BRAND, TrainingPageShell } from "../_components/training-chrome";

export const metadata: Metadata = {
  title: "项目研究入口 · 数智出版与AI出版实训课系列",
  description: "实训课推荐研究项目：MUHUB、ALLMEME、NotebookLM 等",
  robots: { index: false },
};

type ResearchProject = {
  id: string;
  name: string;
  summary: string;
  learningAngle: string;
  links: { label: string; href: string; placeholder?: boolean }[];
  observationTask: string;
};

const PROJECTS: ResearchProject[] = [
  {
    id: "muhub",
    name: "MUHUB",
    summary:
      "AI 原生项目展示与发现平台，聚合 GitHub / 官网 / 社媒等多源信息，为 AI 工具与开源项目提供公众主页与传播链路。",
    learningAngle: "观察 AI 时代「项目公众主页」的信息架构、动态更新机制与出版行业工具库分类方式。",
    links: [
      { label: "MUHUB 首页", href: "/" },
      { label: "出版 AI 工具库", href: "/projects?category=publishing_media" },
    ],
    observationTask:
      "选择一个出版类项目，分析其主页模块构成，并撰写 3 条可为本机构 AI 工具复用的主页建设建议。",
  },
  {
    id: "allmeme",
    name: "ALLMEME",
    summary:
      "面向 meme / 轻内容创作的 AI 工具项目，代表 AI 在短内容、社交传播场景下的应用形态。",
    learningAngle: "从「内容生产 + 社交传播」角度，理解 AI 工具如何服务 C 端创作者与媒体运营。",
    links: [
      { label: "项目主页（占位）", href: "#", placeholder: true },
      { label: "相关 AI 工具搜索", href: "/projects?q=allmeme" },
    ],
    observationTask:
      "对比 ALLMEME 类工具与传统出版营销素材生产流程，列出 AI 可替代与不可替代的环节。",
  },
  {
    id: "notebooklm",
    name: "NotebookLM",
    summary:
      "Google 推出的 AI 笔记本与研究助手，可将文档、PDF、音频等素材转为可对话的知识库，适合深度阅读与内容提炼。",
    learningAngle: "研究「AI + 知识管理」在编辑策划、书稿研读、行业报告整理中的落地场景。",
    links: [
      { label: "NotebookLM 官网", href: "https://notebooklm.google.com/" },
      { label: "MUHUB 相关项目", href: "/projects?q=notebooklm" },
    ],
    observationTask:
      "选取一份出版行业报告或书稿章节，试用 NotebookLM 做摘要与问答，记录效率提升与局限。",
  },
  {
    id: "ai-publishing-tool",
    name: "AI 出版工具（占位）",
    summary:
      "代表一类面向出版全流程（选题、编辑、排版、发行）的垂直 AI 工具，具体项目将根据当期课程素材更新。",
    learningAngle: "建立出版垂直 AI 工具评估框架：场景匹配度、编辑可控性、版权合规、机构落地成本。",
    links: [{ label: "出版 AI 工具库浏览", href: "/projects?category=publishing_media" }],
    observationTask:
      "在工具库中筛选 2 个出版 AI 工具，按上述四维框架完成对比表（可在作业中提交）。",
  },
  {
    id: "digital-content-tool",
    name: "数字内容生产工具（占位）",
    summary:
      "涵盖 AI 图文生成、有声书制作、数字人播报等数字内容生产链路工具，服务新形态出版探索。",
    learningAngle: "理解从「纸书」到「多模态内容」的生产链路变化，评估机构试点优先级。",
    links: [
      { label: "出版 AI 工具库", href: "/projects?category=publishing_media" },
      { label: "新形态出版相关搜索", href: "/projects?q=有声书" },
    ],
    observationTask:
      "选择一个数字内容生产工具，设计一条「纸书 → 有声版 / 短视频」的最小试点流程。",
  },
];

export default function TrainingProjectsPage() {
  return (
    <TrainingPageShell
      title="项目研究入口"
      subtitle="以下项目供实训课学员观察、分析与报告撰写。链接能打开的已直连，其余为占位或搜索入口。"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {PROJECTS.map((project) => (
          <article
            key={project.id}
            className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{project.name}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {project.summary}
            </p>

            <div className="mt-4">
              <div className="text-xs font-semibold uppercase text-zinc-500">学习角度</div>
              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{project.learningAngle}</p>
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold uppercase text-zinc-500">相关链接</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {project.links.map((link) =>
                  link.placeholder ? (
                    <span
                      key={link.label}
                      className="rounded-md border border-dashed border-zinc-300 px-2 py-1 text-xs text-zinc-400 dark:border-zinc-600"
                    >
                      {link.label}
                    </span>
                  ) : link.href.startsWith("http") ? (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 dark:bg-teal-950/50 dark:text-teal-300"
                    >
                      {link.label} ↗
                    </a>
                  ) : (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 dark:bg-teal-950/50 dark:text-teal-300"
                    >
                      {link.label}
                    </Link>
                  ),
                )}
              </div>
            </div>

            <div
              className="mt-4 rounded-lg border-l-2 py-2 pl-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400"
              style={{ borderColor: BRAND.gold, background: "rgba(201,168,76,0.05)" }}
            >
              <span className="font-semibold">学员观察任务：</span>
              {project.observationTask}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500">
          完成观察后，请前往
          <Link href="/training/homework" className="mx-1 font-medium text-teal-600 dark:text-teal-400">
            作业提交
          </Link>
          或参考
          <Link href="/training/cases" className="mx-1 font-medium text-teal-600 dark:text-teal-400">
            案例学习包
          </Link>
          撰写报告。
        </p>
      </div>
    </TrainingPageShell>
  );
}
