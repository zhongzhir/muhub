import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { randomUUID } from "crypto";

import type { GitHubDiscoveryV3Summary } from "./github/github-discovery-v3";

const REL_PATH = join("data", "discovery-run-history.json");
export const DISCOVERY_RUN_HISTORY_MAX = 20;

function historyFilePath(): string {
  return join(process.cwd(), REL_PATH);
}

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

export async function ensureDiscoveryRunHistoryFile(): Promise<void> {
  const path = historyFilePath();
  await mkdir(dirname(path), { recursive: true });
  try {
    await readFile(path, "utf8");
  } catch {
    await writeFile(path, "[]\n", "utf8");
  }
}

export async function readDiscoveryRunHistory(): Promise<DiscoveryRunHistoryEntry[]> {
  await ensureDiscoveryRunHistoryFile();
  const path = historyFilePath();
  try {
    const raw = await readFile(path, "utf8");
    return coerceHistoryArray(JSON.parse(raw));
  } catch {
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
  await ensureDiscoveryRunHistoryFile();
  const path = historyFilePath();
  const prev = await readDiscoveryRunHistory();
  const next = [...prev, entry].slice(-DISCOVERY_RUN_HISTORY_MAX);
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

/** 将 GitHub V3 完整 summary 追加到运行历史（供调度与手动触发共用） */
export async function appendGitHubV3DiscoveryRunHistory(
  summary: GitHubDiscoveryV3Summary,
): Promise<void> {
  await appendDiscoveryRunHistory(githubV3SummaryToHistoryEntry(summary));
}
