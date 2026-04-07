/**
 * Content Analytics 快照落盘（data/content-analytics.json）：保留 latest + 有限 history。
 */

import { mkdir, readFile, writeFile } from "fs/promises"
import { dirname, join } from "path"

import type { ContentAnalyticsFile, ContentAnalyticsSnapshot, FollowingCoverageSnapshot } from "./analytics-types"

const REL_PATH = join("data", "content-analytics.json")
const MAX_HISTORY = 20

function filePath(): string {
  return join(process.cwd(), REL_PATH)
}

function coerceFollowing(raw: unknown): FollowingCoverageSnapshot | null {
  if (!raw || typeof raw !== "object") {
    return null
  }
  const o = raw as Record<string, unknown>
  if (
    typeof o.dbAvailable !== "boolean" ||
    typeof o.subscribedProjectSlugCount !== "number" ||
    typeof o.subscribedProjectsWithRelatedSiteContentCount !== "number"
  ) {
    return null
  }
  return {
    dbAvailable: o.dbAvailable,
    subscribedProjectSlugCount: o.subscribedProjectSlugCount,
    subscribedProjectsWithRelatedSiteContentCount: o.subscribedProjectsWithRelatedSiteContentCount,
  }
}

function coerceCountsRecord(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object") {
    return null
  }
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = v
    }
  }
  return out
}

function coerceSnapshot(raw: unknown): ContentAnalyticsSnapshot | null {
  if (!raw || typeof raw !== "object") {
    return null
  }
  const o = raw as Record<string, unknown>
  if (
    typeof o.generatedAt !== "string" ||
    typeof o.totalSiteContent !== "number" ||
    typeof o.externalPublishCount !== "number"
  ) {
    return null
  }
  const byType = coerceCountsRecord(o.byContentType)
  const publishedByDay = coerceCountsRecord(o.publishedByDay)
  const publishedByWeek = coerceCountsRecord(o.publishedByWeek)
  const following = coerceFollowing(o.followingCoverage)
  const bpc = o.byProjectCoverage
  if (!byType || !publishedByDay || !publishedByWeek || !following || !bpc || typeof bpc !== "object") {
    return null
  }
  const bpco = bpc as Record<string, unknown>
  if (
    typeof bpco.distinctProjectsWithRelatedContent !== "number" ||
    !bpco.relatedContentCountByProjectSlug ||
    typeof bpco.relatedContentCountByProjectSlug !== "object"
  ) {
    return null
  }
  const slugCounts = coerceCountsRecord(bpco.relatedContentCountByProjectSlug)
  if (!slugCounts) {
    return null
  }
  let notes: string[] | undefined
  if (Array.isArray(o.notes) && o.notes.every((x): x is string => typeof x === "string")) {
    notes = o.notes
  }
  return {
    generatedAt: o.generatedAt,
    totalSiteContent: o.totalSiteContent,
    byContentType: byType,
    byProjectCoverage: {
      distinctProjectsWithRelatedContent: bpco.distinctProjectsWithRelatedContent,
      relatedContentCountByProjectSlug: slugCounts,
    },
    publishedByDay,
    publishedByWeek,
    followingCoverage: following,
    externalPublishCount: o.externalPublishCount,
    notes,
  }
}

function safeParseFile(raw: string): ContentAnalyticsFile | null {
  try {
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== "object") {
      return null
    }
    const o = data as Record<string, unknown>
    const latest = coerceSnapshot(o.latest)
    if (!latest) {
      return null
    }
    let history: ContentAnalyticsSnapshot[] = []
    if (Array.isArray(o.history)) {
      history = o.history.map(coerceSnapshot).filter((x): x is ContentAnalyticsSnapshot => x !== null)
    }
    return { latest, history }
  } catch {
    return null
  }
}

export async function readContentAnalyticsFile(): Promise<ContentAnalyticsFile | null> {
  try {
    const parsed = safeParseFile(await readFile(filePath(), "utf8"))
    return parsed
  } catch {
    return null
  }
}

export async function readLatestContentAnalyticsSnapshot(): Promise<ContentAnalyticsSnapshot | null> {
  const f = await readContentAnalyticsFile()
  return f?.latest ?? null
}

/**
 * 将新快照写入 latest，原 latest 插入 history 前端并截断长度。
 */
export async function upsertLatestContentAnalyticsSnapshot(snapshot: ContentAnalyticsSnapshot): Promise<void> {
  const path = filePath()
  const prev = await readContentAnalyticsFile()
  const history: ContentAnalyticsSnapshot[] = []
  if (prev?.latest) {
    history.push(prev.latest, ...(prev.history ?? []))
  }
  const mergedHistory = history.slice(0, MAX_HISTORY)
  const next: ContentAnalyticsFile = {
    latest: snapshot,
    history: mergedHistory,
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8")
}
