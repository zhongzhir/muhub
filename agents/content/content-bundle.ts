/**
 * Content Agent V1：发布资产包（标准对象，供 Growth 后续消费）。
 * 与 agents/growth/content-bundle 中「渠道拆解包」可并存，由编排层选择其一或组合。
 */

import { randomBytes } from "crypto"

import type {
  ContentAgentBundle,
  ContentChannel,
  ContentDraft,
  ContentOpportunity,
} from "./content-types"

export function newContentAgentBundleId(): string {
  return `cbundle-${Date.now()}-${randomBytes(4).toString("hex")}`
}

function bundleTypeFromOpportunity(t: ContentOpportunity["type"]): ContentAgentBundle["bundleType"] {
  switch (t) {
    case "project_spotlight":
      return "spotlight"
    case "project_update_roundup":
      return "update_roundup"
    case "weekly_digest":
      return "weekly_digest"
    case "manual_topic":
      return "manual_topic"
    default:
      return "mixed"
  }
}

/**
 * 由已通过质检的草稿生成 V1 bundle；若列表中无 review_passed 则抛错。
 */
export function createContentAgentBundle(input: {
  opportunity: ContentOpportunity
  drafts: ContentDraft[]
  channelTargets?: ContentChannel[]
  launchReadiness?: ContentAgentBundle["launchReadiness"]
}): ContentAgentBundle {
  const passed = input.drafts.filter((d) => d.status === "review_passed")
  if (!passed.length) {
    throw new Error("createContentAgentBundle: 至少需要一条 status=review_passed 的草稿")
  }
  const channelTargets =
    input.channelTargets && input.channelTargets.length > 0
      ? input.channelTargets
      : [...new Set(passed.map((d) => d.channel))]

  return {
    id: newContentAgentBundleId(),
    opportunityId: input.opportunity.id,
    bundleType: bundleTypeFromOpportunity(input.opportunity.type),
    draftIds: passed.map((d) => d.id),
    channelTargets,
    reviewStatus: "passed",
    launchReadiness: input.launchReadiness ?? "draft",
    createdAt: new Date().toISOString(),
  }
}
