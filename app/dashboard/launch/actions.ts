"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { appendExternalPublishRecord } from "@/agents/growth/external-publish-store"
import {
  formatExternalPostForClipboard,
  generateExternalPost,
  parseExternalPublishChannel,
} from "@/agents/growth/external-publish"
import type { ExternalPublishChannel } from "@/agents/growth/external-publish-types"
import {
  approveLaunchPlan,
  publishLaunchPlan,
  queueLaunchPlan,
} from "@/agents/growth/launch-publish"
import { getLaunchPlanById, upsertLaunchPlan } from "@/agents/growth/launch-plan-store"
import { getSiteContentById } from "@/agents/growth/site-content-store"

async function assertAuthenticated(): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("请先登录")
  }
}

export async function approveLaunchPlanAction(planId: string): Promise<void> {
  await assertAuthenticated()
  const plan = await getLaunchPlanById(planId)
  if (!plan) {
    return
  }
  const next = approveLaunchPlan(plan)
  await upsertLaunchPlan(next)
  revalidatePath("/dashboard/launch")
}

export async function queueLaunchPlanAction(planId: string): Promise<void> {
  await assertAuthenticated()
  const plan = await getLaunchPlanById(planId)
  if (!plan) {
    return
  }
  const next = queueLaunchPlan(plan)
  await upsertLaunchPlan(next)
  revalidatePath("/dashboard/launch")
}

export async function publishLaunchPlanAction(planId: string): Promise<void> {
  await assertAuthenticated()
  await publishLaunchPlan(planId)
  revalidatePath("/dashboard/launch")
}

export type GenerateExternalPostResult =
  | { ok: true; text: string; recordId: string }
  | { ok: false; error: string }

/** 生成外发帖文案并落盘 ExternalPublishRecord；由人工复制到外站，不自动发布。 */
export async function generateExternalPostAction(
  siteContentId: string,
  channelRaw?: string,
): Promise<GenerateExternalPostResult> {
  await assertAuthenticated()
  const id = siteContentId.trim()
  if (!id) {
    return { ok: false, error: "缺少内容 ID。" }
  }
  const channel: ExternalPublishChannel = parseExternalPublishChannel(channelRaw) ?? "generic"
  const content = await getSiteContentById(id)
  if (!content) {
    return { ok: false, error: "未找到对应站内内容，请先完成站内发布。" }
  }
  const payload = generateExternalPost(content, channel)
  const text = formatExternalPostForClipboard(payload, channel)
  const record = await appendExternalPublishRecord({
    contentId: content.id,
    channel,
    status: "generated",
  })
  revalidatePath("/dashboard/launch")
  return { ok: true, text, recordId: record.id }
}
