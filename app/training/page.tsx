/**
 * 出版传媒AI实训营 Demo 页面
 *
 * 路径：/training
 * 用途：向客户展示平台能力的静态 Demo，待客户确认后升级为动态实训管理系统。
 *
 * 设计说明：
 * - 机构品牌色：深夜蓝 #1a2035 + 传媒金 #c9a84c
 * - 平台品牌色：MUHUB teal（延用现有 Tailwind 变量）
 * - 全静态内容，无 DB 调用，可随时部署展示
 */

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "出版传媒AI实训营 · 华闻传媒产业创新研究院",
  description:
    "华闻传媒产业创新研究院出版传媒AI工具实训营，系统掌握AI工具在出版全链条的应用，提升行业数字化能力。",
  robots: { index: false },
};

// ─── 静态数据 ────────────────────────────────────────────────────────────────

const SESSION = {
  name: "出版传媒AI工具实训营",
  edition: "第一期",
  dates: "2026年7月 · 线上+线下",
  status: "报名开放中" as const,
  tagline: "系统掌握AI工具，重塑出版全链条工作方式",
  description:
    "由华闻传媒产业创新研究院主办，依托 MUHUB 出版AI工具库，为出版从业者提供系统化、实战化的AI工具应用培训。覆盖内容生产、版权管理、发行营销、新形态出版等核心场景，帮助学员在真实工作中落地AI能力。",
  capacity: "30人（小班制）",
  audience: "出版社编辑、策划、发行、运营及管理人员",
};

const MODULES = [
  {
    id: "m1",
    index: "01",
    title: "AI辅助内容生产",
    duration: "3课时",
    icon: "✦",
    description: "掌握AI写作辅助、智能编辑校对、多语种翻译工具的实际操作，在保留编辑专业判断的前提下大幅提升内容生产效率。",
    scenes: ["选题策划", "写作辅助", "编辑校对", "翻译"],
    tools: [
      { name: "Claude / ChatGPT", note: "写作辅助与内容改写" },
      { name: "Grammarly Business", note: "英文编辑校对" },
      { name: "DeepL Pro", note: "专业级多语种翻译" },
    ],
    task: "实训任务：选取一篇稿件，用AI工具完成选题延伸、初稿润色、多版本生成全流程，并对比人工与AI协作的效率差异。",
  },
  {
    id: "m2",
    index: "02",
    title: "内容资产管理与版权",
    duration: "2课时",
    icon: "◈",
    description: "了解AI在数字版权管理、元数据处理、档案数字化领域的最新工具，建立出版机构内容资产的数字化管理思路。",
    scenes: ["版权管理", "元数据处理", "档案数字化", "内容审核"],
    tools: [
      { name: "Copytrack", note: "图片版权追踪" },
      { name: "Copyright Hub", note: "数字版权许可管理" },
      { name: "ABBYY FineReader", note: "档案OCR与数字化" },
    ],
    task: "实训任务：使用AI工具为一批历史书目建立结构化元数据，并演示版权侵权扫描的基本流程。",
  },
  {
    id: "m3",
    index: "03",
    title: "AI驱动的发行与营销",
    duration: "3课时",
    icon: "◇",
    description: "系统掌握AI生成营销文案、读者画像分析、社交媒体内容自动化的核心工具，结合出版行业实际案例进行操作演练。",
    scenes: ["营销文案", "读者分析", "个性化推荐", "社交媒体运营"],
    tools: [
      { name: "Midjourney / DALL-E", note: "图书封面与营销素材生成" },
      { name: "Jasper AI", note: "营销文案批量生成" },
      { name: "Sprinklr", note: "社交媒体内容管理" },
    ],
    task: "实训任务：为一本新书设计完整的AI辅助营销方案，包括封面图、宣传语、社媒推文及读者定向分析。",
  },
  {
    id: "m4",
    index: "04",
    title: "新形态出版与前沿探索",
    duration: "2课时",
    icon: "○",
    description: "前瞻性了解AI有声书生成、交互式出版、数字人主播等新形态，结合产业现状评估落地可行性与商业价值。",
    scenes: ["有声书生成", "交互式内容", "数字人主播", "知识图谱"],
    tools: [
      { name: "ElevenLabs", note: "AI有声书与语音克隆" },
      { name: "HeyGen", note: "数字人视频生成" },
      { name: "Pubpub", note: "交互式学术出版平台" },
    ],
    task: "实训任务：选择一本书的前三章，使用AI完整生成有声版本，并探讨数字人主播的出版营销应用场景。",
  },
];

const DEMO_WORKS = [
  {
    id: "w1",
    author: "张 × ×",
    org: "某出版社 策划编辑",
    title: "《AI辅助古籍数字化整理》实训报告",
    summary: "探索 GPT-4o + ABBYY 在古籍 OCR 识别与结构化入库流程中的协同应用，实现识别准确率提升 40%。",
    tags: ["档案数字化", "编辑校对"],
    avatar: "张",
  },
  {
    id: "w2",
    author: "李 × ×",
    org: "某媒体集团 发行主管",
    title: "AI驱动的读者分层推荐模型设计",
    summary: "基于读者行为数据，设计了融合 AI 协同过滤与内容标签的个性化推荐方案，应用于公众号矩阵运营。",
    tags: ["个性化推荐", "读者分析"],
    avatar: "李",
  },
  {
    id: "w3",
    author: "王 × ×",
    org: "某教育出版机构 运营总监",
    title: "ElevenLabs 在教材有声版制作中的应用评测",
    summary: "系统评测了 ElevenLabs 生成教材有声版本的音质、情感表达与成本效益，提供了可落地的制作规范建议。",
    tags: ["有声书生成"],
    avatar: "王",
  },
  {
    id: "w4",
    author: "刘 × ×",
    org: "某出版集团 新媒体编辑",
    title: "AI营销文案在图书宣发中的A/B测试实践",
    summary: "对比人工撰写与 Claude 生成的宣传文案在小红书渠道的实际转化数据，总结了 Prompt 优化的核心方法论。",
    tags: ["营销文案", "社交媒体运营"],
    avatar: "刘",
  },
];

const TOOL_LIBRARY_STATS = {
  total: "150+",
  scenes: "21",
  updated: "2026年6月",
};

// ─── 组件 ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: typeof SESSION.status }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/70 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-600/40 dark:bg-emerald-950/50 dark:text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      {status}
    </span>
  );
}

function SceneTag({ tag }: { tag: string }) {
  return (
    <span className="inline-block rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
      {tag}
    </span>
  );
}

// ─── 页面 ────────────────────────────────────────────────────────────────────

export default function TrainingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* ── 机构品牌顶部 ─────────────────────────────────────── */}
      <div
        className="border-b border-zinc-200 dark:border-zinc-800"
        style={{ background: "linear-gradient(135deg, #1a2035 0%, #243050 100%)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            {/* Logo 占位 */}
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ background: "rgba(201,168,76,0.25)", border: "1px solid #c9a84c" }}
            >
              华
            </div>
            <div>
              <div className="text-sm font-semibold text-white">华闻传媒产业创新研究院</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                中宣部智库单位
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              技术支持
            </span>
            <span
              className="rounded border px-2 py-0.5 text-xs font-medium"
              style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)" }}
            >
              MUHUB 出版AI工具库
            </span>
          </div>
        </div>
      </div>

      {/* ── 实训营 Hero ──────────────────────────────────────── */}
      <section
        className="border-b border-zinc-200 dark:border-zinc-800"
        style={{ background: "linear-gradient(160deg, #1a2035 0%, #1e2a45 55%, #243050 100%)" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <StatusBadge status={SESSION.status} />
              <span
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ background: "rgba(201,168,76,0.15)", color: "#c9a84c", border: "1px solid rgba(201,168,76,0.4)" }}
              >
                {SESSION.edition}
              </span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                {SESSION.dates}
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              {SESSION.name}
            </h1>
            <p className="mt-3 text-base font-medium" style={{ color: "#c9a84c" }}>
              {SESSION.tagline}
            </p>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
              {SESSION.description}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#enroll"
                className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "#c9a84c" }}
              >
                立即报名 →
              </a>
              <a
                href="#modules"
                className="rounded-lg px-6 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                查看课程大纲
              </a>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "培训规模", value: SESSION.capacity },
                { label: "目标学员", value: "出版从业者" },
                { label: "课程模块", value: "4大模块 10课时" },
                { label: "实训成果", value: "可复用工作流" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{item.label}</div>
                  <div className="mt-1 text-sm font-semibold text-white">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 出版AI工具库 入口 Banner ──────────────────────────── */}
      <section className="border-b border-zinc-200 bg-zinc-50 py-10 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="overflow-hidden rounded-2xl border border-teal-200/60 bg-white dark:border-teal-800/40 dark:bg-zinc-900">
            <div className="flex flex-col items-start gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-md bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700 dark:bg-teal-900/60 dark:text-teal-300">
                    实训配套
                  </span>
                  <span className="text-xs text-zinc-400">持续更新</span>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  出版传媒AI工具库
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  由 MUHUB 与华闻传媒产业创新研究院联合整理，覆盖出版全链条
                  <strong className="text-zinc-800 dark:text-zinc-200">{TOOL_LIBRARY_STATS.scenes} 个应用场景</strong>，
                  收录 <strong className="text-zinc-800 dark:text-zinc-200">{TOOL_LIBRARY_STATS.total} 个AI工具</strong>，
                  每期实训前集中更新，配有出版场景适配分析与导读建议。
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["选题策划", "编辑校对", "有声书生成", "版权管理", "营销文案", "数字人主播"].map((tag) => (
                    <SceneTag key={tag} tag={tag} />
                  ))}
                  <span className="inline-block rounded-md px-2 py-0.5 text-xs text-zinc-400">+15个场景…</span>
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-col gap-3 sm:items-end">
                <Link
                  href="/projects?category=publishing_media"
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400"
                >
                  浏览出版AI工具库
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
                <span className="text-xs text-zinc-400">最近更新：{TOOL_LIBRARY_STATS.updated}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 课程模块 ─────────────────────────────────────────── */}
      <section id="modules" className="border-b border-zinc-200 py-16 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">课程大纲</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              4大模块 · 10课时 · 理论讲解 + 工具实操 + 成果提交
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {MODULES.map((mod) => (
              <div
                key={mod.id}
                className="group rounded-2xl border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-base font-bold text-white"
                      style={{ background: "#1a2035" }}
                    >
                      {mod.index}
                    </span>
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{mod.title}</h3>
                      <span className="text-xs text-zinc-400">{mod.duration}</span>
                    </div>
                  </div>
                  <span className="text-lg" style={{ color: "#c9a84c" }}>{mod.icon}</span>
                </div>

                <p className="mb-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {mod.description}
                </p>

                <div className="mb-4 flex flex-wrap gap-1.5">
                  {mod.scenes.map((s) => <SceneTag key={s} tag={s} />)}
                </div>

                <div className="mb-4 rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <div className="mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">推荐工具</div>
                  <div className="space-y-1.5">
                    {mod.tools.map((tool) => (
                      <div key={tool.name} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{tool.name}</span>
                        <span className="text-xs text-zinc-400">— {tool.note}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="rounded-lg border-l-2 py-2 pl-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400"
                  style={{ borderColor: "#c9a84c", background: "rgba(201,168,76,0.05)" }}
                >
                  {mod.task}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 学员成果展示（Demo） ──────────────────────────────── */}
      <section className="border-b border-zinc-200 bg-zinc-50 py-16 dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">学员实训成果</h2>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                每位学员完成课程后提交实训报告，优秀成果在此公开展示
              </p>
            </div>
            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800">
              示例展示
            </span>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {DEMO_WORKS.map((work) => (
              <div
                key={work.id}
                className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ background: "#1a2035" }}
                  >
                    {work.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{work.author}</div>
                    <div className="text-xs text-zinc-400">{work.org}</div>
                  </div>
                </div>
                <h4 className="mb-2 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
                  {work.title}
                </h4>
                <p className="mb-3 flex-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {work.summary}
                </p>
                <div className="flex flex-wrap gap-1">
                  {work.tags.map((t) => <SceneTag key={t} tag={t} />)}
                </div>
              </div>
            ))}
          </div>

          {/* 提交入口（占位） */}
          <div className="mt-8 rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              学员专属提交入口将在课程结束后开放 &nbsp;·&nbsp; 优秀成果经审核后在此展示
            </p>
          </div>
        </div>
      </section>

      {/* ── 报名与联系 ───────────────────────────────────────── */}
      <section id="enroll" className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="overflow-hidden rounded-2xl" style={{ background: "linear-gradient(135deg, #1a2035 0%, #243050 100%)" }}>
            <div className="flex flex-col gap-8 p-8 sm:flex-row sm:items-center sm:p-12">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white">报名参加第一期实训营</h2>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                  小班制 · 限额 {SESSION.capacity.replace("30人（小班制）", "30 人")} · 
                  适合{SESSION.audience}
                </p>
                <div className="mt-6 space-y-2">
                  {[
                    "系统掌握出版AI工具应用方法",
                    "获得可落地的工作流模板与实训报告",
                    "加入华闻传媒产业创新研究院出版数字化交流社群",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                      <span style={{ color: "#c9a84c" }}>✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-col gap-4 sm:min-w-[260px]">
                <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <div className="mb-3 text-xs font-semibold text-white/60">联系咨询</div>
                  <div className="space-y-2 text-sm text-white/80">
                    <div>📧&nbsp; training@huawen-media.cn</div>
                    <div>📱&nbsp; 010-XXXX-XXXX</div>
                    <div className="pt-1 text-xs text-white/40">工作日 09:00–18:00</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: "#c9a84c" }}
                >
                  填写报名表 →
                </button>
                <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                  报名后 1 个工作日内确认
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 底部品牌归属 ─────────────────────────────────────── */}
      <footer className="border-t border-zinc-200 py-8 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center gap-2 text-center text-xs text-zinc-400 sm:flex-row sm:justify-between">
            <span>© 华闻传媒产业创新研究院 · 中宣部智库单位</span>
            <span>
              AI工具库支持：
              <Link href="/" className="underline underline-offset-2 hover:text-zinc-600">
                MUHUB 木哈布
              </Link>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
