/**
 * Growth Launch V1：站内发布计划与已发布站点内容。
 * 位于 Handoff（LaunchCandidate）之后；不涉及外站 API。
 */

import { randomBytes } from "crypto"

import type { ContentDraftType } from "@/agents/content/content-types"

/** 站内发布目标位（V1 仅落盘，由前台按需读取展示） */
export type LaunchTarget = "site_feature" | "site_feed" | "site_digest"

export type LaunchStatus = "draft" | "approved" | "queued" | "published" | "failed" | "archived"

export type LaunchPlan = {
  id: string
  candidateId: string
  /** 关联 growth ContentBundle.id（handoff accept 后）或内容侧追踪 id */
  bundleId: string
  title: string
  summary: string
  contentType: ContentDraftType
  targets: LaunchTarget[]
  status: LaunchStatus
  scheduledAt: string | null
  createdAt: string
  updatedAt: string
  notes?: string
  /** publish 成功后写入 */
  siteContentId?: string
}

export type SiteContent = {
  id: string
  title: string
  summary: string
  body: string
  contentType: ContentDraftType
  bundleId: string
  publishedAt: string
  createdAt: string
  launchPlanId?: string
  /** 站内项目 slug，用于项目详情页关联展示（Content V2） */
  relatedProjectIds?: string[]
}

export function newLaunchPlanId(): string {
  return `lplan-${Date.now()}-${randomBytes(4).toString("hex")}`
}

export function newSiteContentId(): string {
  return `site-${Date.now()}-${randomBytes(4).toString("hex")}`
}
