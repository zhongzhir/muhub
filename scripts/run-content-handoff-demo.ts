/**
 * Handoff V1 演示：bundle + 主草稿 → LaunchCandidate → approve → queue → growth accept。
 *
 * 运行：pnpm handoff:demo
 */

import { appendContentDraft } from "../agents/content/content-draft-store"
import type { ContentAgentBundle, ContentDraft } from "../agents/content/content-types"
import {
  acceptLaunchCandidateById,
  approveLaunchCandidate,
  createLaunchCandidateFromBundle,
  queueLaunchCandidateForGrowth,
} from "../agents/growth/content-handoff"
import { appendLaunchCandidate, upsertLaunchCandidate } from "../agents/growth/content-handoff-store"

async function main() {
  const oppId = `opp-handoff-demo-${Date.now()}`
  const now = new Date().toISOString()
  const draftId = `handoff-demo-draft-${Date.now()}`

  const draft: ContentDraft = {
    id: draftId,
    opportunityId: oppId,
    type: "project-spotlight",
    contentType: "project-spotlight",
    channel: "wechat",
    title: "Handoff 演示：项目速览（仅基建验证）",
    summary: "用于验证 Content→Growth 交接链路；内容样本为占位，不构成任何投资建议。",
    body: [
      "【说明】本稿仅用于本地交接演示，勿对外发布。",
      "",
      "项目在做什么：演示占位，说明 handoff 如何从已质检草稿生成 growth 侧 ContentBundle。",
      "",
      "值得关注的原因：链路可读、可审计；具体业务价值需人工另行撰写。",
      "",
      "欢迎到 MUHUB 项目广场浏览更多资料与动态：/projects",
    ].join("\n"),
    cta: "欢迎到 MUHUB 项目广场浏览更多资料与动态：/projects",
    sourceProjectSlugs: ["demo-handoff"],
    sourceProjectNames: ["演示项目 Handoff"],
    generatedAt: now,
    createdAt: now,
    generatedBy: "content-agent",
    status: "review_passed",
    reviewFlags: [],
    qualityScore: 100,
  }

  const bundle: ContentAgentBundle = {
    id: `cbundle-handoff-demo-${Date.now()}`,
    opportunityId: oppId,
    bundleType: "spotlight",
    draftIds: [draftId],
    channelTargets: ["wechat", "community"],
    reviewStatus: "passed",
    launchReadiness: "ready_for_launch",
    createdAt: now,
  }

  await appendContentDraft(draft)
  console.log("[handoff-demo] appended draft:", draft.id)

  let candidate = createLaunchCandidateFromBundle({ bundle, primaryDraft: draft })
  await appendLaunchCandidate(candidate)
  console.log("[handoff-demo] candidate created:", candidate.id, candidate.handoffStatus)

  candidate = approveLaunchCandidate(candidate, { approvedBy: "demo-operator", comment: "handoff V1 放行" })
  await upsertLaunchCandidate(candidate)
  console.log("[handoff-demo] approved:", candidate.handoffStatus)

  candidate = queueLaunchCandidateForGrowth(candidate)
  await upsertLaunchCandidate(candidate)
  console.log("[handoff-demo] queued:", candidate.handoffStatus)

  const result = await acceptLaunchCandidateById(candidate.id)
  console.log("[handoff-demo] consumed:", result.candidate.handoffStatus)
  console.log("[handoff-demo] growth ContentBundle id:", result.growthBundle.id)
  console.log("[handoff-demo] intake id:", result.intake.id)
  console.log(JSON.stringify(result, null, 2))
}

main().catch((e) => {
  console.error("[handoff-demo] failed", e)
  process.exitCode = 1
})
