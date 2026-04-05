/**
 * Content Agent V1 最小流水线：Opportunity → Draft → Review → Bundle（可选）。
 */

import { assertValidContentOpportunity } from "./map-input"
import { applyReviewToDraft, reviewContentDraft, type ContentReviewResult } from "./content-review"
import { createContentAgentBundle } from "./content-bundle"
import { generateDraftFromOpportunity } from "./content-agent"
import type { ContentAgentBundle, ContentDraft, ContentOpportunity } from "./content-types"

export type ContentPipelineResult = {
  opportunity: ContentOpportunity
  draft: ContentDraft
  review: ContentReviewResult
  bundle: ContentAgentBundle | null
}

/**
 * 单机会全流程（内存态）：不读写磁盘。调用方负责 persist。
 */
export function runContentPipeline(args: {
  opportunity: ContentOpportunity
  /** 同一机会下已存在的草稿，用于简单去重检测 */
  siblingDrafts?: ContentDraft[]
}): ContentPipelineResult {
  assertValidContentOpportunity(args.opportunity)
  const draftBase = generateDraftFromOpportunity(args.opportunity)
  const draft = { ...draftBase, status: "review_pending" as const }
  const review = reviewContentDraft(draft, {
    opportunity: args.opportunity,
    siblingDrafts: args.siblingDrafts,
  })
  const reviewed = applyReviewToDraft(draft, review)
  const bundle = review.passed
    ? createContentAgentBundle({
        opportunity: args.opportunity,
        drafts: [reviewed],
        launchReadiness: "draft",
      })
    : null
  return {
    opportunity: args.opportunity,
    draft: reviewed,
    review,
    bundle,
  }
}
