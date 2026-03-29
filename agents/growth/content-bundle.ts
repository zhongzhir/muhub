/**
 * V13：内容资产包（可直接执行的营销单位）。
 * 聚合一篇文章级草稿 + 多渠道短帖 + 社群转发文案。
 */

import { randomBytes } from "crypto"

import type { ContentDraft } from "@/agents/content/content-types"

import {
  adaptForCommunity,
  adaptForWechat,
  adaptForX,
  adaptForXiaohongshu,
  wechatMomentsFromOfficialCard,
} from "./channel-adapter"

export type ContentBundle = {
  id: string
  title: string
  articleDraftId?: string

  socialPosts: {
    x?: string[]
    xiaohongshu?: string[]
    wechat?: string[]
  }

  communityMessage?: string

  createdAt: string
}

export function newContentBundleId(): string {
  return `bundle-${Date.now()}-${randomBytes(4).toString("hex")}`
}

/**
 * 由 Content Agent 产出的长文草稿组装 Bundle（渠道适配均为规则，无 LLM）。
 */
export function createContentBundleFromDraft(displayTitle: string, draft: ContentDraft): ContentBundle {
  const wechatCard = adaptForWechat(draft)
  return {
    id: newContentBundleId(),
    title: displayTitle,
    articleDraftId: draft.id,
    socialPosts: {
      x: adaptForX(draft),
      xiaohongshu: adaptForXiaohongshu(draft),
      wechat: wechatMomentsFromOfficialCard(draft, wechatCard),
    },
    communityMessage: adaptForCommunity(draft),
    createdAt: new Date().toISOString(),
  }
}
