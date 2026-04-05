/**
 * Launch V1：已发布站内内容快照（data/site-content.json）。
 * 前台可后续接入 feed/feature 页面读取；V1 仅落盘。
 */

import { mkdir, readFile, writeFile } from "fs/promises"
import { dirname, join } from "path"

import type { ContentDraftType } from "@/agents/content/content-types"

import type { SiteContent } from "./launch-plan-types"

const REL_PATH = join("data", "site-content.json")

function filePath(): string {
  return join(process.cwd(), REL_PATH)
}

function coerceSite(raw: unknown): SiteContent | null {
  if (!raw || typeof raw !== "object") {
    return null
  }
  const o = raw as Record<string, unknown>
  if (
    typeof o.id !== "string" ||
    typeof o.title !== "string" ||
    typeof o.summary !== "string" ||
    typeof o.body !== "string" ||
    typeof o.contentType !== "string" ||
    typeof o.bundleId !== "string" ||
    typeof o.publishedAt !== "string" ||
    typeof o.createdAt !== "string"
  ) {
    return null
  }
  return {
    id: o.id,
    title: o.title,
    summary: o.summary,
    body: o.body,
    contentType: o.contentType as ContentDraftType,
    bundleId: o.bundleId,
    publishedAt: o.publishedAt,
    createdAt: o.createdAt,
    launchPlanId: typeof o.launchPlanId === "string" ? o.launchPlanId : undefined,
  }
}

function safeParse(raw: string): SiteContent[] {
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) {
      return []
    }
    return data.map(coerceSite).filter((x): x is SiteContent => x !== null)
  } catch {
    return []
  }
}

export async function readAllSiteContent(): Promise<SiteContent[]> {
  try {
    return safeParse(await readFile(filePath(), "utf8"))
  } catch {
    return []
  }
}

export async function readSiteContentLatestFirst(): Promise<SiteContent[]> {
  const list = await readAllSiteContent()
  return [...list].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

export async function appendSiteContent(row: SiteContent): Promise<void> {
  const path = filePath()
  const list = await readAllSiteContent()
  list.push(row)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(list, null, 2)}\n`, "utf8")
}
