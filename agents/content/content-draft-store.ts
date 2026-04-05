/**
 * V1.2：内容草稿本地 JSON 存储（可迁移 DB）。
 * 路径：data/content-drafts.json
 *
 * 对应设计文档中的「草稿存储」环节：docs/content-agent-v1.md §8、§11。
 */

import { mkdir, readFile, writeFile } from "fs/promises"
import { dirname, join } from "path"

import type { ContentDraft, ContentDraftStatus, ContentDraftType } from "./content-types"

const REL_PATH = join("data", "content-drafts.json")

function filePath(): string {
  return join(process.cwd(), REL_PATH)
}

const VALID_STATUS = new Set<ContentDraftStatus>([
  "created",
  "draft",
  "review_pending",
  "review_passed",
  "review_failed",
  "bundled",
  "archived",
])

function coerceContentDraft(raw: unknown): ContentDraft | null {
  if (!raw || typeof raw !== "object") {
    return null
  }
  const o = raw as Record<string, unknown>
  if (
    typeof o.id !== "string" ||
    typeof o.type !== "string" ||
    typeof o.channel !== "string" ||
    typeof o.title !== "string" ||
    typeof o.body !== "string" ||
    typeof o.generatedAt !== "string" ||
    o.generatedBy !== "content-agent"
  ) {
    return null
  }
  const type = o.type as ContentDraftType
  let status: ContentDraftStatus = "draft"
  if (typeof o.status === "string" && VALID_STATUS.has(o.status as ContentDraftStatus)) {
    status = o.status as ContentDraftStatus
  }
  const contentType = (o.contentType as ContentDraftType | undefined) ?? type
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : (o.generatedAt as string)
  const opportunityId = typeof o.opportunityId === "string" ? o.opportunityId : undefined
  const cta = typeof o.cta === "string" ? o.cta : undefined
  const summary = typeof o.summary === "string" ? o.summary : undefined
  const reviewFlags = Array.isArray(o.reviewFlags)
    ? o.reviewFlags.filter((x): x is string => typeof x === "string")
    : undefined
  const qualityScore = typeof o.qualityScore === "number" ? o.qualityScore : undefined
  const sourceProjectSlugs = Array.isArray(o.sourceProjectSlugs)
    ? o.sourceProjectSlugs.filter((x): x is string => typeof x === "string")
    : undefined
  const sourceProjectNames = Array.isArray(o.sourceProjectNames)
    ? o.sourceProjectNames.filter((x): x is string => typeof x === "string")
    : undefined

  return {
    id: o.id,
    opportunityId,
    type,
    contentType,
    channel: o.channel as ContentDraft["channel"],
    title: o.title,
    summary,
    body: o.body,
    cta,
    sourceProjectSlugs,
    sourceProjectNames,
    generatedAt: o.generatedAt as string,
    createdAt,
    generatedBy: "content-agent",
    status,
    reviewFlags,
    qualityScore,
  }
}

function safeParse(raw: string): ContentDraft[] {
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) {
      return []
    }
    return data.map(coerceContentDraft).filter((x): x is ContentDraft => x !== null)
  } catch {
    return []
  }
}

export async function readAllContentDrafts(): Promise<ContentDraft[]> {
  const path = filePath()
  try {
    const raw = await readFile(path, "utf8")
    return safeParse(raw)
  } catch {
    return []
  }
}

/** 新草稿在前 */
export async function readContentDraftsLatestFirst(): Promise<ContentDraft[]> {
  const list = await readAllContentDrafts()
  return [...list].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
}

export async function getContentDraftById(id: string): Promise<ContentDraft | undefined> {
  const list = await readAllContentDrafts()
  return list.find((d) => d.id === id)
}

export async function appendContentDraft(draft: ContentDraft): Promise<void> {
  const path = filePath()
  const existing = await readAllContentDrafts()
  existing.push(draft)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(existing, null, 2)}\n`, "utf8")
}
