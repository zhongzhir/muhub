"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import {
  approveLaunchPlan,
  publishLaunchPlan,
  queueLaunchPlan,
} from "@/agents/growth/launch-publish"
import { getLaunchPlanById, upsertLaunchPlan } from "@/agents/growth/launch-plan-store"

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
