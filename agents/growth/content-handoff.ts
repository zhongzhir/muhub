/**
 * Content → Growth Handoff V1：纯状态转换 + 最小 growth 消费（接受 candidate → 既有 ContentBundle）。
 * 见 docs/content-to-growth-handoff-v1.md。
 */

import { randomBytes } from "crypto"

import { getContentDraftById } from "@/agents/content/content-draft-store"
import type { ContentAgentBundle, ContentDraft } from "@/agents/content/content-types"

import { appendBundle } from "./content-bundle-store"
import { createContentBundleFromDraft, type ContentBundle } from "./content-bundle"
import {
  appendLaunchIntakeStub,
  getLaunchCandidateById,
  type GrowthLaunchIntakeStub,
  upsertLaunchCandidate,
} from "./content-handoff-store"
import { type ContentLaunchCandidate, newLaunchCandidateId } from "./launch-candidate"

export class ContentHandoffError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ContentHandoffError"
  }
}

/** 由已通过内容质检的 agent bundle + 主草稿生成候选（handoff 待审） */
export function createLaunchCandidateFromBundle(input: {
  bundle: ContentAgentBundle
  primaryDraft: ContentDraft
}): ContentLaunchCandidate {
  const { bundle, primaryDraft } = input
  if (bundle.reviewStatus !== "passed") {
    throw new ContentHandoffError("ContentAgentBundle.reviewStatus 必须为 passed 才能创建 launch candidate")
  }
  if (primaryDraft.status !== "review_passed") {
    throw new ContentHandoffError("primaryDraft 必须为 review_passed")
  }
  if (!bundle.draftIds.includes(primaryDraft.id)) {
    throw new ContentHandoffError("primaryDraft.id 须包含在 bundle.draftIds 中")
  }

  const now = new Date().toISOString()
  return {
    id: newLaunchCandidateId(),
    bundleId: bundle.id,
    opportunityId: bundle.opportunityId,
    contentType: primaryDraft.contentType,
    title: primaryDraft.title,
    summary: (primaryDraft.summary ?? primaryDraft.title).slice(0, 500),
    draftIds: [...bundle.draftIds],
    channelTargets: [...bundle.channelTargets],
    reviewStatus: bundle.reviewStatus === "passed" ? "passed" : "pending",
    handoffStatus: "pending_review",
    launchReadiness: bundle.launchReadiness,
    createdAt: now,
    updatedAt: now,
  }
}

/** 运营 handoff 放行（不修改正文） */
export function approveLaunchCandidate(
  c: ContentLaunchCandidate,
  opts?: { approvedBy?: string; comment?: string },
): ContentLaunchCandidate {
  if (c.handoffStatus !== "pending_review") {
    throw new ContentHandoffError(`approve 要求 handoffStatus=pending_review，当前为 ${c.handoffStatus}`)
  }
  const now = new Date().toISOString()
  return {
    ...c,
    handoffStatus: "approved_for_growth",
    approval: {
      approvedAt: now,
      approvedBy: opts?.approvedBy,
      comment: opts?.comment,
    },
    updatedAt: now,
  }
}

export function rejectLaunchCandidate(c: ContentLaunchCandidate, reason: string): ContentLaunchCandidate {
  if (c.handoffStatus === "consumed_by_growth") {
    throw new ContentHandoffError("已 consumed_by_growth 的 candidate 不可 reject")
  }
  const now = new Date().toISOString()
  return {
    ...c,
    handoffStatus: "rejected",
    notes: reason.trim(),
    updatedAt: now,
  }
}

export function queueLaunchCandidateForGrowth(c: ContentLaunchCandidate): ContentLaunchCandidate {
  if (c.handoffStatus !== "approved_for_growth") {
    throw new ContentHandoffError(`queue 要求 handoffStatus=approved_for_growth，当前为 ${c.handoffStatus}`)
  }
  const now = new Date().toISOString()
  return {
    ...c,
    handoffStatus: "queued_for_growth",
    updatedAt: now,
  }
}

function newIntakeStubId(): string {
  return `lintake-${Date.now()}-${randomBytes(3).toString("hex")}`
}

export type AcceptLaunchCandidateResult = {
  candidate: ContentLaunchCandidate
  growthBundle: ContentBundle
  intake: GrowthLaunchIntakeStub
}

/**
 * Growth 最小消费：校验 handoff → 用主草稿生成既有 ContentBundle → 落盘 → 记 intake → candidate consumed。
 * 不重跑 content-review。
 */
export async function acceptLaunchCandidateById(launchCandidateId: string): Promise<AcceptLaunchCandidateResult> {
  const existing = await getLaunchCandidateById(launchCandidateId)
  if (!existing) {
    throw new ContentHandoffError(`launch candidate 不存在: ${launchCandidateId}`)
  }
  if (existing.handoffStatus !== "approved_for_growth" && existing.handoffStatus !== "queued_for_growth") {
    throw new ContentHandoffError(
      `accept 要求 handoffStatus 为 approved_for_growth 或 queued_for_growth，当前为 ${existing.handoffStatus}`,
    )
  }

  const primaryDraftId = existing.draftIds[0]
  if (!primaryDraftId) {
    throw new ContentHandoffError("candidate.draftIds 为空")
  }
  const draft = await getContentDraftById(primaryDraftId)
  if (!draft) {
    throw new ContentHandoffError(`找不到主草稿: ${primaryDraftId}`)
  }
  if (draft.status !== "review_passed") {
    throw new ContentHandoffError(`主草稿须为 review_passed，当前为 ${draft.status}`)
  }

  const growthBundle = createContentBundleFromDraft(existing.title, draft)
  await appendBundle(growthBundle)

  const now = new Date().toISOString()
  const intake: GrowthLaunchIntakeStub = {
    id: newIntakeStubId(),
    launchCandidateId: existing.id,
    growthContentBundleId: growthBundle.id,
    primaryDraftId: draft.id,
    acceptedAt: now,
  }
  await appendLaunchIntakeStub(intake)

  const updated: ContentLaunchCandidate = {
    ...existing,
    handoffStatus: "consumed_by_growth",
    growthIntakeId: intake.id,
    updatedAt: now,
  }
  await upsertLaunchCandidate(updated)

  return { candidate: updated, growthBundle, intake }
}
