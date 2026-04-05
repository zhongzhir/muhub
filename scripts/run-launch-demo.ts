/**
 * Growth Launch V1 演示：Handoff（candidate 消费）→ LaunchPlan → approve → queue → publish → SiteContent。
 *
 * 运行：pnpm launch:demo
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
import {
  approveLaunchPlan,
  createLaunchPlanFromCandidate,
  publishLaunchPlan,
  queueLaunchPlan,
} from "../agents/growth/launch-publish"
import { appendLaunchPlan, upsertLaunchPlan } from "../agents/growth/launch-plan-store"

async function main() {
  const oppId = `opp-launch-demo-${Date.now()}`
  const now = new Date().toISOString()
  const draftId = `launch-demo-draft-${Date.now()}`

  const draft: ContentDraft = {
    id: draftId,
    opportunityId: oppId,
    type: "project-spotlight",
    contentType: "project-spotlight",
    channel: "wechat",
    title: "Launch V1 演示：站内发布链路",
    summary: "验证 LaunchPlan → SiteContent；样本占位，勿作投资依据。",
    body: [
      "【Launch V1】本段用于站内 site-content 落盘演示。",
      "",
      "项目在做什么：说明 Growth Launch 与 Handoff、Content Agent 的衔接。",
      "",
      "值得关注的原因：流程可审计、可回放；具体叙述以人工为准。",
      "",
      "欢迎到 MUHUB 项目广场浏览更多资料与动态：/projects",
    ].join("\n"),
    cta: "欢迎到 MUHUB 项目广场浏览更多资料与动态：/projects",
    sourceProjectSlugs: ["launch-demo"],
    sourceProjectNames: ["Launch Demo 项目"],
    generatedAt: now,
    createdAt: now,
    generatedBy: "content-agent",
    status: "review_passed",
    reviewFlags: [],
    qualityScore: 100,
  }

  const bundle: ContentAgentBundle = {
    id: `cbundle-launch-demo-${Date.now()}`,
    opportunityId: oppId,
    bundleType: "spotlight",
    draftIds: [draftId],
    channelTargets: ["wechat", "community"],
    reviewStatus: "passed",
    launchReadiness: "ready_for_launch",
    createdAt: now,
  }

  await appendContentDraft(draft)

  let candidate = createLaunchCandidateFromBundle({ bundle, primaryDraft: draft })
  await appendLaunchCandidate(candidate)
  candidate = approveLaunchCandidate(candidate, { approvedBy: "launch-demo", comment: "handoff" })
  await upsertLaunchCandidate(candidate)
  candidate = queueLaunchCandidateForGrowth(candidate)
  await upsertLaunchCandidate(candidate)

  const accept = await acceptLaunchCandidateById(candidate.id)
  const consumed = accept.candidate
  const growthBundleId = accept.growthBundle.id

  const plan = createLaunchPlanFromCandidate(consumed, {
    bundleId: growthBundleId,
    targets: ["site_feed", "site_digest"],
    notes: "run-launch-demo",
  })
  await appendLaunchPlan(plan)

  let lp = approveLaunchPlan(plan)
  await upsertLaunchPlan(lp)
  lp = queueLaunchPlan(lp)
  await upsertLaunchPlan(lp)

  const published = await publishLaunchPlan(lp.id)
  console.log("[launch-demo] plan:", published.plan.id, published.plan.status)
  console.log("[launch-demo] siteContent:", published.siteContent.id)
  console.log(JSON.stringify(published, null, 2))
}

main().catch((e) => {
  console.error("[launch-demo] failed", e)
  process.exitCode = 1
})