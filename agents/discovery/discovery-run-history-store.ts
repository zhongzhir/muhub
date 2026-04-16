import { randomUUID } from "crypto";

import type { GitHubDiscoveryV3Summary } from "./github/github-discovery-v3";
import { prisma } from "@/lib/prisma";
import { DiscoverySourceType } from "@prisma/client";

export const DISCOVERY_RUN_HISTORY_MAX = 20;
const GITHUB_V3_RUNTIME_SOURCE_KEY = "github-v3-runtime";

/** 与 GitHub V3 summary 对齐的可持久化子集（JSON 友好） */
export type DiscoveryRunHistoryGitHubV3Entry = {
  id: string;
  type: "github-v3";
  startedAt: string;
  finishedAt: string;
  totalKeywords: number;
  keywordsProcessed: number;
  topicsProcessed: number;
  relatedSeedsProcessed: number;
  keywordCursorStart: number;
  nextKeywordCursor: number;
  inserted: number;
  skipped: number;
  filtered: number;
  invalid: number;
  intentsUsed: string[];
  filterReasons: Record<string, number>;
  byKeyword: Record<string, { inserted: number; filtered: number; skipped: number }>;
  byIntent: Record<string, { inserted: number; filtered: number; skipped: number }>;
  bySource: Record<string, { inserted: number; filtered: number; skipped: number }>;
  failedKeywords: string[];
  failedTopics: string[];
};

export type DiscoveryRunHistoryEntry = DiscoveryRunHistoryGitHubV3Entry;

function isGithubV3Entry(row: unknown): row is DiscoveryRunHistoryGitHubV3Entry {
  if (!row || typeof row !== "object") {
    return false;
  }
  const o = row as Record<string, unknown>;
  return o.type === "github-v3" && typeof o.id === "string" && typeof o.startedAt === "string";
}

function coerceHistoryArray(raw: unknown): DiscoveryRunHistoryEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(isGithubV3Entry);
}

async function ensureRuntimeSource() {
  return prisma.discoverySource.upsert({
    where: { key: GITHUB_V3_RUNTIME_SOURCE_KEY },
    update: {},
    create: {
      key: GITHUB_V3_RUNTIME_SOURCE_KEY,
      name: "GitHub V3 Runtime",
      type: DiscoverySourceType.GITHUB,
      subtype: "runtime",
      status: "ACTIVE",
      configJson: { githubV3KeywordCursor: 0 },
    },
    select: { id: true },
  });
}

export async function ensureDiscoveryRunHistoryFile(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    return;
  }
  try {
    await ensureRuntimeSource();
  } catch (e) {
    console.warn("[discovery-run-history-store] failed to initialize db run history source", e);
  }
}

export async function readDiscoveryRunHistory(): Promise<DiscoveryRunHistoryEntry[]> {
  if (!process.env.DATABASE_URL?.trim()) {
    return [];
  }
  try {
    const source = await ensureRuntimeSource();
    const rows = await prisma.discoveryRun.findMany({
      where: { sourceId: source.id },
      orderBy: { startedAt: "desc" },
      take: DISCOVERY_RUN_HISTORY_MAX,
      select: {
        id: true,
        startedAt: true,
        finishedAt: true,
        logJson: true,
      },
    });
    const entries: DiscoveryRunHistoryEntry[] = [];
    for (const row of rows) {
      const parsed = coerceHistoryArray([row.logJson]).at(0);
      if (parsed) {
        entries.push(parsed);
      }
    }
    return entries.reverse();
  } catch (e) {
    console.warn("[discovery-run-history-store] failed to read db run history", e);
    return [];
  }
}

function filterReasonsToRecord(
  reasons: GitHubDiscoveryV3Summary["filterReasons"],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(reasons)) {
    if (typeof v === "number" && v > 0) {
      out[k] = v;
    }
  }
  return out;
}

export function githubV3SummaryToHistoryEntry(
  summary: GitHubDiscoveryV3Summary,
): DiscoveryRunHistoryGitHubV3Entry {
  return {
    id: randomUUID(),
    type: "github-v3",
    startedAt: summary.startedAt,
    finishedAt: summary.finishedAt,
    totalKeywords: summary.totalKeywords,
    keywordsProcessed: summary.keywordsProcessed,
    topicsProcessed: summary.topicsProcessed,
    relatedSeedsProcessed: summary.relatedSeedsProcessed,
    keywordCursorStart: summary.keywordCursorStart,
    nextKeywordCursor: summary.nextKeywordCursor,
    inserted: summary.inserted,
    skipped: summary.skipped,
    filtered: summary.filtered,
    invalid: summary.invalid,
    intentsUsed: [...summary.intentsUsed],
    filterReasons: filterReasonsToRecord(summary.filterReasons),
    byKeyword: { ...summary.byKeyword },
    byIntent: {
      active: { ...summary.byIntent.active },
      new: { ...summary.byIntent.new },
      popular: { ...summary.byIntent.popular },
    },
    bySource: {
      keyword: { ...summary.bySource.keyword },
      topic: { ...summary.bySource.topic },
      related: { ...summary.bySource.related },
    },
    failedKeywords: [...summary.failedKeywords],
    failedTopics: [...summary.failedTopics],
  };
}

export async function appendDiscoveryRunHistory(entry: DiscoveryRunHistoryEntry): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    return;
  }
  try {
    const source = await ensureRuntimeSource();
    await prisma.discoveryRun.create({
      data: {
        sourceId: source.id,
        status: "SUCCESS",
        startedAt: new Date(entry.startedAt),
        finishedAt: new Date(entry.finishedAt),
        fetchedCount: entry.keywordsProcessed + entry.topicsProcessed + entry.relatedSeedsProcessed,
        parsedCount: entry.keywordsProcessed,
        newCandidateCount: entry.inserted,
        updatedCandidateCount: entry.skipped,
        skippedCount: entry.skipped + entry.filtered + entry.invalid,
        logJson: entry,
      },
    });
  } catch (e) {
    console.warn("[discovery-run-history-store] failed to persist db run history", e);
  }
}

/** 将 GitHub V3 完整 summary 追加到运行历史（供调度与手动触发共用） */
export async function appendGitHubV3DiscoveryRunHistory(
  summary: GitHubDiscoveryV3Summary,
): Promise<void> {
  await appendDiscoveryRunHistory(githubV3SummaryToHistoryEntry(summary));
}
