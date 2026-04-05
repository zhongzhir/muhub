/**
 * Growth Launch V1：LaunchCandidate → LaunchPlan → SiteContent（站内发布）。
 */

import { getContentDraftById } from "@/agents/content/content-draft-store"

import { getLaunchCandidateById } from "./content-handoff-store"
import type { ContentLaunchCandidate } from "./launch-candidate"
import { getLaunchPlanById, upsertLaunchPlan } from "./launch-plan-store"
import type { LaunchPlan, LaunchTarget, SiteContent } from "./launch-plan-types"
import { newLaunchPlanId, newSiteContentId } from "./launch-plan-types"
import { appendSiteContent } from "./site-content-store"

export class LaunchPublishError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LaunchPublishError"
  }
}

/** 由已 handoff 的 LaunchCandidate 创建计划（draft） */
export function createLaunchPlanFromCandidate(
  candidate: ContentLaunchCandidate,
  input: {
    bundleId: string
    targets: LaunchTarget[]
    notes?: string
    scheduledAt?: string | null
  },
): LaunchPlan {
  if (candidate.handoffStatus !== "consumed_by_growth") {
    throw new LaunchPublishError(
      `创建 LaunchPlan 需要 candidate.handoffStatus=consumed_by_growth，当前为 ${candidate.handoffStatus}`,
    )
  }
  const now = new Date().toISOString()
  return {
    id: newLaunchPlanId(),
    candidateId: candidate.id,
    bundleId: input.bundleId,
    title: candidate.title,
    summary: candidate.summary,
    contentType: candidate.contentType,
    targets: [...input.targets],
    status: "draft",
    scheduledAt: input.scheduledAt ?? null,
    createdAt: now,
    updatedAt: now,
    notes: input.notes,
  }
}

export function approveLaunchPlan(plan: LaunchPlan): LaunchPlan {
  if (plan.status !== "draft") {
    throw new LaunchPublishError(`approve 要求 status=draft，当前为 ${plan.status}`)
  }
  const now = new Date().toISOString()
  return { ...plan, status: "approved", updatedAt: now }
}

export function queueLaunchPlan(plan: LaunchPlan): LaunchPlan {
  if (plan.status !== "approved") {
    throw new LaunchPublishError(`queue 要求 status=approved，当前为 ${plan.status}`)
  }
  const now = new Date().toISOString()
  return { ...plan, status: "queued", updatedAt: now }
}

export type PublishLaunchPlanResult = {
  plan: LaunchPlan
  siteContent: SiteContent
}

/**
 * 站内发布：仅当 status === queued；从候选主草稿取 body，写入 SiteContent，计划标为 published。
 */
export async function publishLaunchPlan(planId: string): Promise<PublishLaunchPlanResult> {
  const plan = await getLaunchPlanById(planId)
  if (!plan) {
    throw new LaunchPublishError(`LaunchPlan 不存在: ${planId}`)
  }
  if (plan.status !== "queued") {
    throw new LaunchPublishError(`publish 要求 status=queued，当前为 ${plan.status}`)
  }

  const candidate = await getLaunchCandidateById(plan.candidateId)
  if (!candidate) {
    throw new LaunchPublishError(`LaunchCandidate 不存在: ${plan.candidateId}`)
  }
  const primaryDraftId = candidate.draftIds[0]
  if (!primaryDraftId) {
    throw new LaunchPublishError("candidate.draftIds 为空")
  }
  const draft = await getContentDraftById(primaryDraftId)
  if (!draft) {
    throw new LaunchPublishError(`草稿不存在: ${primaryDraftId}`)
  }

  const now = new Date().toISOString()
  const siteContent: SiteContent = {
    id: newSiteContentId(),
    title: plan.title,
    summary: plan.summary,
    body: draft.body,
    contentType: plan.contentType,
    bundleId: plan.bundleId,
    publishedAt: now,
    createdAt: now,
    launchPlanId: plan.id,
  }

  await appendSiteContent(siteContent)

  const updated: LaunchPlan = {
    ...plan,
    status: "published",
    siteContentId: siteContent.id,
    updatedAt: now,
  }
  await upsertLaunchPlan(updated)

  return { plan: updated, siteContent }
}
