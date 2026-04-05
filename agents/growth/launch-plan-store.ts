/**
 * Launch V1：本地 JSON（data/launch-plans.json）。
 */

import { mkdir, readFile, writeFile } from "fs/promises"
import { dirname, join } from "path"

import type { LaunchPlan, LaunchStatus, LaunchTarget } from "./launch-plan-types"

const REL_PATH = join("data", "launch-plans.json")

function filePath(): string {
  return join(process.cwd(), REL_PATH)
}

const STATUSES = new Set<LaunchStatus>([
  "draft",
  "approved",
  "queued",
  "published",
  "failed",
  "archived",
])

const TARGETS = new Set<LaunchTarget>(["site_feature", "site_feed", "site_digest"])

function coercePlan(raw: unknown): LaunchPlan | null {
  if (!raw || typeof raw !== "object") {
    return null
  }
  const o = raw as Record<string, unknown>
  if (
    typeof o.id !== "string" ||
    typeof o.candidateId !== "string" ||
    typeof o.bundleId !== "string" ||
    typeof o.title !== "string" ||
    typeof o.summary !== "string" ||
    typeof o.contentType !== "string" ||
    typeof o.createdAt !== "string" ||
    typeof o.updatedAt !== "string"
  ) {
    return null
  }
  const st = o.status
  if (typeof st !== "string" || !STATUSES.has(st as LaunchStatus)) {
    return null
  }
  if (!Array.isArray(o.targets) || !o.targets.every((t) => typeof t === "string" && TARGETS.has(t as LaunchTarget))) {
    return null
  }
  let scheduledAt: string | null = null
  if (o.scheduledAt === null) {
    scheduledAt = null
  } else if (typeof o.scheduledAt === "string") {
    scheduledAt = o.scheduledAt
  }
  return {
    id: o.id,
    candidateId: o.candidateId,
    bundleId: o.bundleId,
    title: o.title,
    summary: o.summary,
    contentType: o.contentType as LaunchPlan["contentType"],
    targets: o.targets as LaunchTarget[],
    status: st as LaunchStatus,
    scheduledAt,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    notes: typeof o.notes === "string" ? o.notes : undefined,
    siteContentId: typeof o.siteContentId === "string" ? o.siteContentId : undefined,
  }
}

function safeParse(raw: string): LaunchPlan[] {
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) {
      return []
    }
    return data.map(coercePlan).filter((x): x is LaunchPlan => x !== null)
  } catch {
    return []
  }
}

export async function readAllLaunchPlans(): Promise<LaunchPlan[]> {
  try {
    return safeParse(await readFile(filePath(), "utf8"))
  } catch {
    return []
  }
}

export async function readLaunchPlansLatestFirst(): Promise<LaunchPlan[]> {
  const list = await readAllLaunchPlans()
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getLaunchPlanById(id: string): Promise<LaunchPlan | undefined> {
  const list = await readAllLaunchPlans()
  return list.find((p) => p.id === id)
}

export async function upsertLaunchPlan(plan: LaunchPlan): Promise<void> {
  const path = filePath()
  const list = await readAllLaunchPlans()
  const i = list.findIndex((p) => p.id === plan.id)
  if (i >= 0) {
    list[i] = plan
  } else {
    list.push(plan)
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(list, null, 2)}\n`, "utf8")
}

export async function appendLaunchPlan(plan: LaunchPlan): Promise<void> {
  const path = filePath()
  const list = await readAllLaunchPlans()
  list.push(plan)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(list, null, 2)}\n`, "utf8")
}
