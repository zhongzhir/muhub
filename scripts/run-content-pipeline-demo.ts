/**
 * Content Agent V1 最小流水线演示：Opportunity → Draft → Review → Bundle。
 *
 * 运行：pnpm content:pipeline
 */

import { appendContentAgentBundle } from "../agents/content/content-bundle-store"
import { appendContentDraft } from "../agents/content/content-draft-store"
import { runContentPipeline } from "../agents/content/content-pipeline"
import {
  mapManualTopicInput,
  mapProjectSpotlightInput,
  mapProjectUpdateRoundupInput,
  mapWeeklyDigestInput,
} from "../agents/content/map-input"
import type { ContentDraft, ContentProjectInput } from "../agents/content/content-types"

const DEMO_PROJECTS: ContentProjectInput[] = [
  {
    slug: "demo-volcano-write",
    name: "火山写作助手",
    tagline: "面向中文场景的 AI 写作与改写工具",
    description: "强调模板化公文与营销文案效率，适合小团队冷启动试错。",
    tags: ["AI", "写作", "SaaS"],
    websiteUrl: "https://example.com/volcano-write",
    githubUrl: "https://github.com/example/volcano-write",
  },
  {
    slug: "demo-data-pipeline",
    name: "开源数据清洗流水线",
    tagline: "轻量 ETL 与质量校验",
    tags: ["开源", "数据", "ETL"],
    githubUrl: "https://gitee.com/example/data-pipeline",
  },
  {
    slug: "demo-ops-bot",
    name: "社群运营机器人",
    tagline: "微信群/飞书群的问答与工单分流",
    tags: ["社群", "自动化"],
    websiteUrl: "https://example.com/ops-bot",
  },
]

async function main() {
  const opportunities = [
    mapProjectSpotlightInput({
      sourceType: "manual",
      project: DEMO_PROJECTS[0]!,
      evidence: [{ note: "样本来自本地演示数据", sourceKey: "pipeline-demo" }],
    }),
    mapProjectUpdateRoundupInput({
      sourceType: "dashboard",
      projects: [DEMO_PROJECTS[0]!, DEMO_PROJECTS[1]!],
      timeWindowNote: "演示用自然周",
    }),
    mapWeeklyDigestInput({
      sourceType: "scheduler",
      projects: DEMO_PROJECTS,
    }),
    mapManualTopicInput({
      title: "国内 AI 工具冷启动选题（演示）",
      summary:
        "整理一批近期在社群和仓库里仍然活跃、偏工程落地的中文 AI 与工具向项目，供内部周报与转载备选；样本有限，仅作结构演示，不构成任何投资建议。",
      projects: [DEMO_PROJECTS[2]!],
    }),
    // 故意触发货检失败（投资口吻）
    mapManualTopicInput({
      title: "应被拒绝的演示稿",
      summary:
        "本条仅用于验证质检：我们建议买入某标的并看涨百倍，属于不应出现的表述。正文应被 review 拒绝。",
    }),
  ]

  const siblings: ContentDraft[] = []

  for (const opportunity of opportunities) {
    const result = runContentPipeline({ opportunity, siblingDrafts: [...siblings] })
    siblings.push(result.draft)

    console.log("\n=== pipeline ===")
    console.log("opportunity:", opportunity.id, opportunity.type)
    console.log("review.passed:", result.review.passed, "score:", result.review.score)
    console.log("review.flags:", result.review.flags)
    console.log("draft.status:", result.draft.status, "draft.id:", result.draft.id)
    console.log("bundle:", result.bundle ? result.bundle.id : null)

    await appendContentDraft(result.draft)
    if (result.bundle) {
      await appendContentAgentBundle(result.bundle)
    }
  }

  console.log("\n[content-pipeline-demo] done. Appended drafts + bundles (if passed).")
}

main().catch((e) => {
  console.error("[content-pipeline-demo] failed", e)
  process.exitCode = 1
})
