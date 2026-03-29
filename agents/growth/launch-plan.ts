/**
 * V1.3：冷启动内容执行计划（Launch Plan）。
 * 组合 Content Agent → 渠道适配 → ContentBundle；规则生成，无 LLM。
 */

import { appendContentDraft } from "@/agents/content/content-draft-store"
import {
  generateProjectRoundupDraft,
  generateProjectSpotlightDraft,
  generateTrendObservationDraft,
} from "@/agents/content/content-agent"
import type { ContentDraft, ContentProjectInput } from "@/agents/content/content-types"

import { createContentBundleFromDraft, type ContentBundle } from "./content-bundle"

/** 与 run-content-agent 类似的冷启动样本，避免依赖 DB */
const LAUNCH_SAMPLE_PROJECTS: ContentProjectInput[] = [
  {
    slug: "launch-sample-a",
    name: "星流绘图",
    tagline: "中文提示词友好的图像生成工作流",
    description: "偏创作者与小团队，强调模板与批量出图。",
    tags: ["AI", "图像", "工作流"],
    websiteUrl: "https://example.com/starflow",
    githubUrl: "https://github.com/example/starflow",
  },
  {
    slug: "launch-sample-b",
    name: "格物数据标定台",
    tagline: "表格数据清洗与标注一体化",
    tags: ["数据", "B2B", "开源"],
    githubUrl: "https://gitee.com/example/gewu-label",
  },
  {
    slug: "launch-sample-c",
    name: "小满客服助手",
    tagline: "微信/企业微信内的轻量问答机器人",
    tags: ["客服", "LLM", "企业"],
    websiteUrl: "https://example.com/xiaoman-bot",
  },
  {
    name: "季风评测笔记",
    tagline: "面向国内场景的模型对比小测",
    tags: ["评测", "大模型"],
    githubUrl: "https://github.com/example/monsoon-bench",
  },
  {
    name: "城隅低代码表单",
    tagline: "活动报名与线索收集，5 分钟发布",
    tags: ["低代码", "运营"],
    websiteUrl: "https://example.com/city-form",
  },
]

/**
 * 生成首批 5 个内容方向对应的资产包（含文章草稿落盘 + 多渠道短帖）。
 */
export async function generateInitialLaunchPlan(): Promise<{ bundles: ContentBundle[] }> {
  const bundles: ContentBundle[] = []

  const persistDraft = async (displayTitle: string, draft: ContentDraft) => {
    await appendContentDraft(draft)
    bundles.push(createContentBundleFromDraft(displayTitle, draft))
  }

  // 1. 今日发现 5 个 AI 项目
  const d1 = generateProjectRoundupDraft(LAUNCH_SAMPLE_PROJECTS, {
    theme: "today-ai-five",
    channel: "article",
  })
  await persistDraft("今日发现 5 个 AI 项目", d1)

  // 2. 最近国内 AI 项目观察
  const d2 = generateProjectRoundupDraft(LAUNCH_SAMPLE_PROJECTS.slice(0, 4), {
    theme: "interesting-domestic-picks",
    channel: "article",
  })
  await persistDraft("最近国内 AI 项目观察", d2)

  // 3. AI 创业趋势观察（趋势稿，bundle 展示名与内文标题可不同）
  const d3 = generateTrendObservationDraft(LAUNCH_SAMPLE_PROJECTS, {
    channel: "article",
    extraTags: ["冷启动", "创业"],
  })
  await persistDraft("AI 创业趋势观察", d3)

  // 4. 单项目 spotlight
  const d4 = generateProjectSpotlightDraft(LAUNCH_SAMPLE_PROJECTS[0]!, { channel: "article" })
  await persistDraft(`单项目 spotlight：${LAUNCH_SAMPLE_PROJECTS[0]!.name}`, d4)

  // 5. 本周 AI 项目推荐
  const d5 = generateProjectRoundupDraft(LAUNCH_SAMPLE_PROJECTS, {
    theme: "weekly-cn-ai-opensource",
    channel: "article",
  })
  await persistDraft("本周 AI 项目推荐", d5)

  return { bundles }
}
