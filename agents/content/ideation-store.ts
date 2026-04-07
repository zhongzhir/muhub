/**
 * Content Ideas 本地 JSON（data/content-ideas.json）；与 Launch / Draft 管线解耦。
 */

import { mkdir, readFile, writeFile } from "fs/promises"
import { dirname, join } from "path"

import type {
  ContentIdea,
  ContentIdeaSourceType,
  ContentIdeaStatus,
  ContentIdeaType,
} from "./ideation-types"

const REL_PATH = join("data", "content-ideas.json")

const IDEA_TYPES = new Set<ContentIdeaType>([
  "project_spotlight",
  "project_update_roundup",
  "topic_watch",
  "weekly_digest",
  "followup_topic",
])

const SOURCE_TYPES = new Set<ContentIdeaSourceType>(["project_update", "site_content", "manual_topic", "mixed"])

const STATUSES = new Set<ContentIdeaStatus>(["new", "accepted", "rejected", "converted"])

function filePath(): string {
  return join(process.cwd(), REL_PATH)
}

function coerceStringArray(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined
  }
  const out = raw.filter((x): x is string => typeof x === "string" && x.length > 0)
  return out.length ? out : undefined
}

function coerceIdea(raw: unknown): ContentIdea | null {
  if (!raw || typeof raw !== "object") {
    return null
  }
  const o = raw as Record<string, unknown>
  if (
    typeof o.id !== "string" ||
    typeof o.title !== "string" ||
    typeof o.summary !== "string" ||
    typeof o.createdAt !== "string" ||
    typeof o.priority !== "number"
  ) {
    return null
  }
  const ideaType = o.ideaType
  const sourceType = o.sourceType
  const status = o.status
  if (typeof ideaType !== "string" || !IDEA_TYPES.has(ideaType as ContentIdeaType)) {
    return null
  }
  if (typeof sourceType !== "string" || !SOURCE_TYPES.has(sourceType as ContentIdeaSourceType)) {
    return null
  }
  if (typeof status !== "string" || !STATUSES.has(status as ContentIdeaStatus)) {
    return null
  }
  return {
    id: o.id,
    ideaType: ideaType as ContentIdeaType,
    title: o.title,
    summary: o.summary,
    sourceType: sourceType as ContentIdeaSourceType,
    projectSlugs: coerceStringArray(o.projectSlugs),
    relatedContentIds: coerceStringArray(o.relatedContentIds),
    evidence: coerceStringArray(o.evidence),
    priority: o.priority,
    status: status as ContentIdeaStatus,
    createdAt: o.createdAt,
  }
}

function safeParse(raw: string): ContentIdea[] {
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) {
      return []
    }
    return data.map(coerceIdea).filter((x): x is ContentIdea => x !== null)
  } catch {
    return []
  }
}

export async function readAllContentIdeas(): Promise<ContentIdea[]> {
  try {
    return safeParse(await readFile(filePath(), "utf8"))
  } catch {
    return []
  }
}

export async function readContentIdeasLatestFirst(): Promise<ContentIdea[]> {
  const list = await readAllContentIdeas()
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

async function writeAllIdeas(list: ContentIdea[]): Promise<void> {
  const path = filePath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(list, null, 2)}\n`, "utf8")
}

export async function upsertContentIdea(idea: ContentIdea): Promise<void> {
  const list = await readAllContentIdeas()
  const i = list.findIndex((x) => x.id === idea.id)
  if (i >= 0) {
    list[i] = idea
  } else {
    list.push(idea)
  }
  await writeAllIdeas(list)
}

export async function appendContentIdeas(ideas: ContentIdea[]): Promise<void> {
  if (ideas.length === 0) {
    return
  }
  const list = await readAllContentIdeas()
  list.push(...ideas)
  await writeAllIdeas(list)
}
