/**
 * Content Analytics Agent V1：从 SiteContent、外发记录与关注关系做结构性聚合。
 * 不产出趋势结论、不向「优劣」排序、不做增长归因。
 */

import type { SiteContent } from "@/agents/growth/launch-plan-types"
import { readAllExternalPublishRecords } from "@/agents/growth/external-publish-store"
import { readAllSiteContent } from "@/agents/growth/site-content-store"
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter"
import { prisma } from "@/lib/prisma"

import type {
  ContentAnalyticsSnapshot,
  FollowingCoverageSnapshot,
  PublishedByDay,
  PublishedByWeek,
} from "./analytics-types"

function sortKeysNumericValues<T extends Record<string, number>>(obj: T): T {
  const out = {} as T
  for (const k of Object.keys(obj).sort((a, b) => a.localeCompare(b))) {
    out[k as keyof T] = obj[k] as T[keyof T]
  }
  return out
}

function utcDateKeyFromPublished(iso: string): string | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) {
    return null
  }
  return new Date(t).toISOString().slice(0, 10)
}

/** 该 UTC 日期所在的「周」以周一为周起始，返回该周周一 YYYY-MM-DD */
function utcWeekStartMondayKey(iso: string): string | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) {
    return null
  }
  const d = new Date(t)
  const dow = d.getUTCDay() // 0 Sun .. 6 Sat
  const offsetToMonday = (dow + 6) % 7
  d.setUTCDate(d.getUTCDate() - offsetToMonday)
  return d.toISOString().slice(0, 10)
}

function countByContentType(contents: SiteContent[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const c of contents) {
    const k = String(c.contentType)
    m[k] = (m[k] ?? 0) + 1
  }
  return sortKeysNumericValues(m)
}

function projectCoverageFromContents(contents: SiteContent[]): {
  distinctProjectsWithRelatedContent: number
  relatedContentCountByProjectSlug: Record<string, number>
} {
  const counts = new Map<string, number>()
  for (const c of contents) {
    for (const raw of c.relatedProjectIds ?? []) {
      const slug = raw.trim()
      if (!slug) {
        continue
      }
      counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
  }
  const relatedContentCountByProjectSlug = sortKeysNumericValues(
    Object.fromEntries(counts) as Record<string, number>,
  )
  return {
    distinctProjectsWithRelatedContent: counts.size,
    relatedContentCountByProjectSlug,
  }
}

function publishedHistograms(contents: SiteContent[]): { byDay: PublishedByDay; byWeek: PublishedByWeek } {
  const byDay: PublishedByDay = {}
  const byWeek: PublishedByWeek = {}
  for (const c of contents) {
    const dk = utcDateKeyFromPublished(c.publishedAt)
    if (dk) {
      byDay[dk] = (byDay[dk] ?? 0) + 1
    }
    const wk = utcWeekStartMondayKey(c.publishedAt)
    if (wk) {
      byWeek[wk] = (byWeek[wk] ?? 0) + 1
    }
  }
  return {
    byDay: sortKeysNumericValues(byDay),
    byWeek: sortKeysNumericValues(byWeek),
  }
}

async function loadFollowingCoverage(slugsWithRelatedSiteContent: Set<string>): Promise<FollowingCoverageSnapshot> {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      dbAvailable: false,
      subscribedProjectSlugCount: 0,
      subscribedProjectsWithRelatedSiteContentCount: 0,
    }
  }
  try {
    const rows = await prisma.projectFollow.findMany({
      where: { project: PROJECT_ACTIVE_FILTER },
      select: {
        project: { select: { slug: true } },
      },
    })
    const subscribedSlugs = [...new Set(rows.map((r) => r.project.slug).filter(Boolean))]
    const withContent = subscribedSlugs.filter((s) => slugsWithRelatedSiteContent.has(s)).length
    return {
      dbAvailable: true,
      subscribedProjectSlugCount: subscribedSlugs.length,
      subscribedProjectsWithRelatedSiteContentCount: withContent,
    }
  } catch {
    return {
      dbAvailable: false,
      subscribedProjectSlugCount: 0,
      subscribedProjectsWithRelatedSiteContentCount: 0,
    }
  }
}

/** 构建一次完整快照（仅计数与集合运算）。 */
export async function buildContentAnalyticsSnapshot(): Promise<ContentAnalyticsSnapshot> {
  const generatedAt = new Date().toISOString()
  const [contents, externals] = await Promise.all([readAllSiteContent(), readAllExternalPublishRecords()])

  const slugsWithContent = new Set<string>()
  for (const c of contents) {
    for (const raw of c.relatedProjectIds ?? []) {
      const s = raw.trim()
      if (s) {
        slugsWithContent.add(s)
      }
    }
  }

  const coverage = projectCoverageFromContents(contents)
  const hist = publishedHistograms(contents)
  const followingCoverage = await loadFollowingCoverage(slugsWithContent)

  return {
    generatedAt,
    totalSiteContent: contents.length,
    byContentType: countByContentType(contents),
    byProjectCoverage: {
      distinctProjectsWithRelatedContent: coverage.distinctProjectsWithRelatedContent,
      relatedContentCountByProjectSlug: coverage.relatedContentCountByProjectSlug,
    },
    publishedByDay: hist.byDay,
    publishedByWeek: hist.byWeek,
    followingCoverage,
    externalPublishCount: externals.length,
    notes: [
      "Structural counts only; no ranking, scoring, or performance conclusions.",
      "Project slug buckets sorted lexicographically; weekly buckets keyed by UTC Monday date.",
    ],
  }
}
