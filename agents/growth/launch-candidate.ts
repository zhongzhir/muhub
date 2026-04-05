/**
 * Content → Growth 交接对象（Handoff V1）。
 * 说明见 docs/content-to-growth-handoff-v1.md。
 */

import { randomBytes } from "crypto"

import type { ContentChannel, ContentDraftType } from "@/agents/content/content-types"

/** 交接层状态（运营放行与 growth 接手） */
export type ContentHandoffStatus =
  | "pending_review"
  | "approved_for_growth"
  | "rejected"
  | "queued_for_growth"
  | "consumed_by_growth"
  | "archived"

/** 来自 Content Agent / bundle 的质检快照，handoff 不重审正文 */
export type LaunchCandidateContentReviewSnapshot = "pending" | "passed" | "failed"

export type LaunchCandidateApproval = {
  approvedAt?: string
  approvedBy?: string
  comment?: string
}

/**
 * 一条可交给 Growth 消费的「上线候选」。
 * 由 ContentAgentBundle + 主草稿摘要生成；不包含渠道适配正文（由 growth accept 时生成）。
 */
export type ContentLaunchCandidate = {
  id: string
  bundleId: string
  opportunityId: string
  contentType: ContentDraftType
  title: string
  summary: string
  draftIds: string[]
  channelTargets: ContentChannel[]
  /** Content 侧质检快照（与 bundle.reviewStatus 对齐） */
  reviewStatus: LaunchCandidateContentReviewSnapshot
  handoffStatus: ContentHandoffStatus
  launchReadiness: "draft" | "ready_for_launch" | "hold" | "archived"
  approval?: LaunchCandidateApproval
  notes?: string
  createdAt: string
  updatedAt: string
  /** accept 后写入，对应 growth-launch-intake-stub 记录 id */
  growthIntakeId?: string
}

export function newLaunchCandidateId(): string {
  return `lcand-${Date.now()}-${randomBytes(4).toString("hex")}`
}
