/**
 * Handoff V1：本地 JSON。
 * - data/content-launch-candidates.json
 * - data/growth-launch-intake-stub.json（accept 审计占位）
 */

import { mkdir, readFile, writeFile } from "fs/promises"
import { dirname, join } from "path"

import type { ContentLaunchCandidate } from "./launch-candidate"

const CANDIDATES_PATH = join("data", "content-launch-candidates.json")
const INTAKE_PATH = join("data", "growth-launch-intake-stub.json")

export type GrowthLaunchIntakeStub = {
  id: string
  launchCandidateId: string
  growthContentBundleId: string
  primaryDraftId: string
  acceptedAt: string
}

function candidatesFile(): string {
  return join(process.cwd(), CANDIDATES_PATH)
}

function intakeFile(): string {
  return join(process.cwd(), INTAKE_PATH)
}

const HANDOFF = new Set<ContentLaunchCandidate["handoffStatus"]>([
  "pending_review",
  "approved_for_growth",
  "rejected",
  "queued_for_growth",
  "consumed_by_growth",
  "archived",
])

const CONTENT_REV = new Set<ContentLaunchCandidate["reviewStatus"]>(["pending", "passed", "failed"])

const READINESS = new Set<ContentLaunchCandidate["launchReadiness"]>([
  "draft",
  "ready_for_launch",
  "hold",
  "archived",
])

function coerceCandidate(raw: unknown): ContentLaunchCandidate | null {
  if (!raw || typeof raw !== "object") {
    return null
  }
  const o = raw as Record<string, unknown>
  if (
    typeof o.id !== "string" ||
    typeof o.bundleId !== "string" ||
    typeof o.opportunityId !== "string" ||
    typeof o.contentType !== "string" ||
    typeof o.title !== "string" ||
    typeof o.summary !== "string" ||
    typeof o.createdAt !== "string" ||
    typeof o.updatedAt !== "string"
  ) {
    return null
  }
  const hs = o.handoffStatus
  const rs = o.reviewStatus
  const lr = o.launchReadiness
  if (typeof hs !== "string" || !HANDOFF.has(hs as ContentLaunchCandidate["handoffStatus"])) {
    return null
  }
  if (typeof rs !== "string" || !CONTENT_REV.has(rs as ContentLaunchCandidate["reviewStatus"])) {
    return null
  }
  if (typeof lr !== "string" || !READINESS.has(lr as ContentLaunchCandidate["launchReadiness"])) {
    return null
  }
  if (!Array.isArray(o.draftIds) || !o.draftIds.every((x) => typeof x === "string")) {
    return null
  }
  if (!Array.isArray(o.channelTargets) || !o.channelTargets.every((x) => typeof x === "string")) {
    return null
  }

  return {
    id: o.id,
    bundleId: o.bundleId,
    opportunityId: o.opportunityId,
    contentType: o.contentType as ContentLaunchCandidate["contentType"],
    title: o.title,
    summary: o.summary,
    draftIds: o.draftIds as string[],
    channelTargets: o.channelTargets as ContentLaunchCandidate["channelTargets"],
    reviewStatus: rs as ContentLaunchCandidate["reviewStatus"],
    handoffStatus: hs as ContentLaunchCandidate["handoffStatus"],
    launchReadiness: lr as ContentLaunchCandidate["launchReadiness"],
    approval:
      o.approval && typeof o.approval === "object"
        ? (o.approval as ContentLaunchCandidate["approval"])
        : undefined,
    notes: typeof o.notes === "string" ? o.notes : undefined,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    growthIntakeId: typeof o.growthIntakeId === "string" ? o.growthIntakeId : undefined,
  }
}

function parseCandidates(raw: string): ContentLaunchCandidate[] {
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) {
      return []
    }
    return data.map(coerceCandidate).filter((x): x is ContentLaunchCandidate => x !== null)
  } catch {
    return []
  }
}

function coerceIntake(raw: unknown): GrowthLaunchIntakeStub | null {
  if (!raw || typeof raw !== "object") {
    return null
  }
  const o = raw as Record<string, unknown>
  if (
    typeof o.id !== "string" ||
    typeof o.launchCandidateId !== "string" ||
    typeof o.growthContentBundleId !== "string" ||
    typeof o.primaryDraftId !== "string" ||
    typeof o.acceptedAt !== "string"
  ) {
    return null
  }
  return {
    id: o.id,
    launchCandidateId: o.launchCandidateId,
    growthContentBundleId: o.growthContentBundleId,
    primaryDraftId: o.primaryDraftId,
    acceptedAt: o.acceptedAt,
  }
}

function parseIntake(raw: string): GrowthLaunchIntakeStub[] {
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) {
      return []
    }
    return data.map(coerceIntake).filter((x): x is GrowthLaunchIntakeStub => x !== null)
  } catch {
    return []
  }
}

export async function readAllLaunchCandidates(): Promise<ContentLaunchCandidate[]> {
  const path = candidatesFile()
  try {
    return parseCandidates(await readFile(path, "utf8"))
  } catch {
    return []
  }
}

export async function getLaunchCandidateById(id: string): Promise<ContentLaunchCandidate | undefined> {
  const all = await readAllLaunchCandidates()
  return all.find((c) => c.id === id)
}

export async function upsertLaunchCandidate(candidate: ContentLaunchCandidate): Promise<void> {
  const path = candidatesFile()
  const list = await readAllLaunchCandidates()
  const i = list.findIndex((c) => c.id === candidate.id)
  if (i >= 0) {
    list[i] = candidate
  } else {
    list.push(candidate)
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(list, null, 2)}\n`, "utf8")
}

export async function appendLaunchCandidate(candidate: ContentLaunchCandidate): Promise<void> {
  const path = candidatesFile()
  const list = await readAllLaunchCandidates()
  list.push(candidate)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(list, null, 2)}\n`, "utf8")
}

export async function readAllLaunchIntakeStubs(): Promise<GrowthLaunchIntakeStub[]> {
  const path = intakeFile()
  try {
    return parseIntake(await readFile(path, "utf8"))
  } catch {
    return []
  }
}

export async function appendLaunchIntakeStub(stub: GrowthLaunchIntakeStub): Promise<void> {
  const path = intakeFile()
  const list = await readAllLaunchIntakeStubs()
  list.push(stub)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(list, null, 2)}\n`, "utf8")
}
