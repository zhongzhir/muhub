/**
 * CLI：生成若干条冷启动内容草稿并写入 data/content-drafts.json。
 * 不接 LLM；用于本地验证 Content Agent 与草稿存储。
 *
 * 运行：pnpm content:generation
 */

import {
  generateContentDraft,
  generateProjectRoundupDraft,
  generateSocialPostDraft,
} from "../agents/content/content-agent"
import type { ContentProjectInput } from "../agents/content/content-types"
import { appendContentDraft } from "../agents/content/content-draft-store"

const MOCK_PROJECTS: ContentProjectInput[] = [
  {
    slug: "mock-huoshan-writing",
    name: "火山写作助手",
    tagline: "面向中文场景的 AI 写作与改写工具",
    description: "强调模板化公文与营销文案效率，适合小团队冷启动试错。",
    tags: ["AI", "写作", "SaaS", "中文"],
    websiteUrl: "https://example.com/volcano-write",
    githubUrl: "https://github.com/example/volcano-write",
  },
  {
    slug: "mock-open-data-pipeline",
    name: "开源数据清洗流水线",
    tagline: "轻量 ETL 与质量校验，偏国内企业表格场景",
    description: "社区里常见的「先把表洗干净」需求，用可控规则集减少大模型幻觉。",
    tags: ["开源", "数据", "ETL", "企业"],
    githubUrl: "https://gitee.com/example/data-pipeline",
  },
  {
    slug: "mock-community-ops-bot",
    name: "社群运营机器人",
    tagline: "微信群/飞书群的问答与工单分流",
    tags: ["社群", "自动化", "中国"],
    websiteUrl: "https://example.com/ops-bot",
  },
  {
    name: "Vision 海报生成器",
    tagline: "活动主视觉与裂变海报一键出图",
    description: "偏市场运营侧，适合与 MUHUB 项目广场的「工具向」选题联动。",
    tags: ["设计", "营销", "AI"],
    websiteUrl: "https://example.com/vision-poster",
  },
  {
    name: "EdgeBench 评测集",
    tagline: "国内常用场景的 LLM 侧评分基准（样本级）",
    tags: ["评测", "开源", "大模型"],
    githubUrl: "https://github.com/example/edge-bench",
  },
]

async function main() {
  const drafts = [
    generateProjectRoundupDraft(MOCK_PROJECTS.slice(0, 5), {
      theme: "today-ai-five",
      channel: "wechat",
    }),
    generateContentDraft({
      kind: "trend-observation",
      projects: MOCK_PROJECTS,
      extraTags: ["冷启动", "2026"],
      channel: "article",
    }),
    generateContentDraft({
      kind: "project-spotlight",
      project: MOCK_PROJECTS[0]!,
      channel: "wechat",
    }),
    generateSocialPostDraft(MOCK_PROJECTS.slice(0, 3), {
      variant: "recommend",
      channel: "xiaohongshu",
    }),
    /** 覆盖「最近看到的几个有意思的国内项目」叙事 */
    generateContentDraft({
      kind: "project-roundup",
      projects: MOCK_PROJECTS.slice(1, 4),
      theme: "interesting-domestic-picks",
      channel: "community",
    }),
  ]

  for (const d of drafts) {
    await appendContentDraft(d)
    console.log("[content-agent] saved draft:", d.id, d.type, d.title.slice(0, 48))
  }

  console.log("[content-agent] done, total appended:", drafts.length)
}

main().catch((e) => {
  console.error("[content-agent] failed", e)
  process.exitCode = 1
})
