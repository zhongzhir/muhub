/**
 * V1：ContentAgentBundle 本地 JSON 存储（可迁移 DB）。
 * 路径：data/content-agent-bundles.json
 */

import { mkdir, readFile, writeFile } from "fs/promises"
import { dirname, join } from "path"

import type { ContentAgentBundle } from "./content-types"

const REL_PATH = join("data", "content-agent-bundles.json")

function filePath(): string {
  return join(process.cwd(), REL_PATH)
}

const READINESS = new Set(["draft", "ready_for_launch", "hold", "archived"])
const REVIEW = new Set(["pending", "passed", "failed"])
const BUNDLE_TYPES = new Set(["spotlight", "update_roundup", "weekly_digest", "manual_topic", "mixed"])

function coerceBundle(raw: unknown): ContentAgentBundle | null {
  if (!raw || typeof raw !== "object") {
    return null
  }
  const o = raw as Record<string, unknown>
  if (typeof o.id !== "string" || typeof o.opportunityId !== "string" || typeof o.createdAt !== "string") {
    return null
  }
  const bt = o.bundleType
  if (typeof bt !== "string" || !BUNDLE_TYPES.has(bt)) {
    return null
  }
  const rs = o.reviewStatus
  if (typeof rs !== "string" || !REVIEW.has(rs)) {
    return null
  }
  const lr = o.launchReadiness
  if (typeof lr !== "string" || !READINESS.has(lr)) {
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
    opportunityId: o.opportunityId,
    bundleType: bt as ContentAgentBundle["bundleType"],
    draftIds: o.draftIds as string[],
    channelTargets: o.channelTargets as ContentAgentBundle["channelTargets"],
    reviewStatus: rs as ContentAgentBundle["reviewStatus"],
    launchReadiness: lr as ContentAgentBundle["launchReadiness"],
    createdAt: o.createdAt,
  }
}

function safeParse(raw: string): ContentAgentBundle[] {
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) {
      return []
    }
    return data.map(coerceBundle).filter((x): x is ContentAgentBundle => x !== null)
  } catch {
    return []
  }
}

export async function readAllContentAgentBundles(): Promise<ContentAgentBundle[]> {
  const path = filePath()
  try {
    const raw = await readFile(path, "utf8")
    return safeParse(raw)
  } catch {
    return []
  }
}

export async function appendContentAgentBundle(bundle: ContentAgentBundle): Promise<void> {
  const path = filePath()
  const existing = await readAllContentAgentBundles()
  existing.push(bundle)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(existing, null, 2)}\n`, "utf8")
}
