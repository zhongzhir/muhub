/**
 * V1.2：内容草稿本地 JSON 存储（可迁移 DB）。
 * 路径：data/content-drafts.json
 */

import { mkdir, readFile, writeFile } from "fs/promises"
import { dirname, join } from "path"
import type { ContentDraft } from "./content-types"

const REL_PATH = join("data", "content-drafts.json")

function filePath(): string {
  return join(process.cwd(), REL_PATH)
}

function safeParse(raw: string): ContentDraft[] {
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) {
      return []
    }
    return data.filter(isContentDraft)
  } catch {
    return []
  }
}

function isContentDraft(x: unknown): x is ContentDraft {
  if (!x || typeof x !== "object") {
    return false
  }
  const o = x as Record<string, unknown>
  return (
    typeof o.id === "string" &&
    typeof o.type === "string" &&
    typeof o.channel === "string" &&
    typeof o.title === "string" &&
    typeof o.body === "string" &&
    typeof o.generatedAt === "string" &&
    o.generatedBy === "content-agent" &&
    o.status === "draft"
  )
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
