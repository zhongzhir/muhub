import { fetchGithubSearchRepositories } from "../github-search";
import type { GithubRepoSearchItem } from "../github-search";
import type { GitHubV3Intent, GitHubV3SchedulerConfig } from "../scheduler/discovery-scheduler-config";
import { findDiscoveryItemByUrl } from "../discovery-store";
import { createDiscoveryItemFromGitHubUrlWithMeta } from "./github-discovery";
import {
  filterGithubRepository,
  type GithubDiscoveryFilterReason,
} from "./github-discovery-filter";
import { GITHUB_DISCOVERY_KEYWORDS } from "./github-discovery-keywords";
import {
  GITHUB_DISCOVERY_TOPICS,
  searchGitHubReposByTopic,
} from "./github-discovery-topics";
import {
  searchGitHubRelatedRepos,
  type GitHubRelatedSeed,
} from "./github-discovery-related";
import { normalizeGitHubRepoUrl } from "./github-utils";
import {
  readDiscoveryRuntimeState,
  updateGitHubV3KeywordCursor,
} from "../discovery-runtime-store";
import { appendGitHubV3DiscoveryRunHistory } from "../discovery-run-history-store";

type GitHubSearchPlan = {
  intent: GitHubV3Intent;
  query: string;
  sort: "updated" | "stars";
  perPage: number;
};

type GitHubRepoCandidate = {
  url: string;
  intent: GitHubV3Intent;
  repo: GithubRepoSearchItem;
};

type DiscoverySourceKind = "keyword" | "topic" | "related";

type DiscoveryStageStats = { inserted: number; filtered: number; skipped: number };

type KeywordDiscoveryRunResult = {
  summary: GitHubKeywordDiscoverySummary;
  relatedSeeds: GitHubRelatedSeed[];
};

export type GitHubKeywordDiscoverySummary = {
  keyword: string;
  byIntent: Record<GitHubV3Intent, { inserted: number; filtered: number; skipped: number }>;
  inserted: number;
  skipped: number;
  filtered: number;
  invalid: number;
  errors: number;
  filterReasons: Partial<Record<GithubDiscoveryFilterReason, number>>;
};

export type GitHubDiscoveryV3Summary = {
  startedAt: string;
  finishedAt: string;
  totalKeywords: number;
  keywordsProcessed: number;
  maxKeywordsPerRun: number;
  keywordCursorStart: number;
  keywordCursorEnd: number;
  nextKeywordCursor: number;
  keywordsSelected: string[];
  intentsUsed: GitHubV3Intent[];
  truncatedByMaxKeywordsPerRun: boolean;
  topicsProcessed: number;
  relatedSeedsProcessed: number;
  inserted: number;
  skipped: number;
  filtered: number;
  invalid: number;
  bySource: Record<DiscoverySourceKind, DiscoveryStageStats>;
  byKeyword: Record<string, { inserted: number; filtered: number; skipped: number }>;
  byIntent: Record<GitHubV3Intent, { inserted: number; filtered: number; skipped: number }>;
  filterReasons: Partial<Record<GithubDiscoveryFilterReason, number>>;
  failedKeywords: string[];
  failedTopics: string[];
};

type GitHubDiscoveryV3RuntimeConfig = Pick<
  GitHubV3SchedulerConfig,
  | "intents"
  | "maxKeywordsPerRun"
  | "enableTopicDiscovery"
  | "maxTopicsPerRun"
  | "enableRelatedDiscovery"
  | "maxRelatedSeeds"
  | "searchDelayMs"
>;

const DEFAULT_RUNTIME_CONFIG: GitHubDiscoveryV3RuntimeConfig = {
  intents: ["active", "new", "popular"],
  maxKeywordsPerRun: 10,
  enableTopicDiscovery: true,
  maxTopicsPerRun: 10,
  enableRelatedDiscovery: true,
  maxRelatedSeeds: 5,
  searchDelayMs: 1500,
};

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function sanitizeRuntimeConfig(
  input?: Partial<GitHubDiscoveryV3RuntimeConfig>,
): GitHubDiscoveryV3RuntimeConfig {
  const intents = input?.intents?.length ? input.intents : DEFAULT_RUNTIME_CONFIG.intents;
  const maxKeywordsPerRunRaw = input?.maxKeywordsPerRun ?? DEFAULT_RUNTIME_CONFIG.maxKeywordsPerRun;
  const maxTopicsPerRunRaw = input?.maxTopicsPerRun ?? DEFAULT_RUNTIME_CONFIG.maxTopicsPerRun;
  const maxRelatedSeedsRaw = input?.maxRelatedSeeds ?? DEFAULT_RUNTIME_CONFIG.maxRelatedSeeds;
  const searchDelayMsRaw = input?.searchDelayMs ?? DEFAULT_RUNTIME_CONFIG.searchDelayMs;
  const maxKeywordsPerRun = Math.max(1, Math.floor(maxKeywordsPerRunRaw));
  const maxTopicsPerRun = Math.max(1, Math.floor(maxTopicsPerRunRaw));
  const maxRelatedSeeds = Math.max(1, Math.floor(maxRelatedSeedsRaw));
  const searchDelayMs = Math.max(0, Math.floor(searchDelayMsRaw));
  return {
    intents,
    maxKeywordsPerRun,
    enableTopicDiscovery: input?.enableTopicDiscovery ?? DEFAULT_RUNTIME_CONFIG.enableTopicDiscovery,
    maxTopicsPerRun,
    enableRelatedDiscovery: input?.enableRelatedDiscovery ?? DEFAULT_RUNTIME_CONFIG.enableRelatedDiscovery,
    maxRelatedSeeds,
    searchDelayMs,
  };
}

function buildSearchPlanForIntent(keyword: string, intent: GitHubV3Intent): GitHubSearchPlan {
  const pushedAfter = isoDaysAgo(90);
  const createdAfter = isoDaysAgo(60);
  const pushedAfterPopular = isoDaysAgo(365);
  const createdAfterPopular = isoDaysAgo(180);
  if (intent === "active") {
    return {
      intent,
      query: `${keyword} stars:>10 pushed:>${pushedAfter}`,
      sort: "updated",
      perPage: 20,
    };
  }
  if (intent === "new") {
    return {
      intent,
      query: `${keyword} created:>${createdAfter} stars:>3`,
      sort: "updated",
      perPage: 20,
    };
  }
  return {
    intent,
    query: `${keyword} stars:>50 pushed:>${pushedAfterPopular} created:>${createdAfterPopular}`,
    sort: "stars",
    perPage: 20,
  };
}

function emptyIntentStats(): Record<GitHubV3Intent, { inserted: number; filtered: number; skipped: number }> {
  return {
    active: { inserted: 0, filtered: 0, skipped: 0 },
    new: { inserted: 0, filtered: 0, skipped: 0 },
    popular: { inserted: 0, filtered: 0, skipped: 0 },
  };
}

function mergeReasonCounter(
  target: Partial<Record<GithubDiscoveryFilterReason, number>>,
  source: Partial<Record<GithubDiscoveryFilterReason, number>>,
): void {
  for (const [k, v] of Object.entries(source)) {
    if (!v) {
      continue;
    }
    const key = k as GithubDiscoveryFilterReason;
    target[key] = (target[key] ?? 0) + v;
  }
}

function emptyStageStats(): Record<DiscoverySourceKind, DiscoveryStageStats> {
  return {
    keyword: { inserted: 0, filtered: 0, skipped: 0 },
    topic: { inserted: 0, filtered: 0, skipped: 0 },
    related: { inserted: 0, filtered: 0, skipped: 0 },
  };
}

function recordFilterReason(
  reasons: Partial<Record<GithubDiscoveryFilterReason, number>>,
  reason: GithubDiscoveryFilterReason,
): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

function selectKeywordsForRun(
  allKeywords: readonly string[],
  cursorRaw: number,
  maxKeywordsPerRun: number,
): {
  selected: string[];
  cursorStart: number;
  cursorEnd: number;
  nextCursor: number;
} {
  const total = allKeywords.length;
  if (total === 0) {
    return { selected: [], cursorStart: 0, cursorEnd: 0, nextCursor: 0 };
  }
  const batchSize = Math.min(total, Math.max(1, Math.floor(maxKeywordsPerRun)));
  const cursorStart = ((Math.floor(cursorRaw) % total) + total) % total;
  const selected: string[] = [];
  for (let i = 0; i < batchSize; i += 1) {
    selected.push(allKeywords[(cursorStart + i) % total] ?? "");
  }
  const cursorEnd = (cursorStart + batchSize - 1) % total;
  const nextCursor = (cursorStart + batchSize) % total;
  return { selected, cursorStart, cursorEnd, nextCursor };
}

export async function searchGitHubReposByKeyword(
  keyword: string,
  intents: GitHubV3Intent[],
  searchDelayMs: number,
): Promise<GitHubRepoCandidate[]> {
  const plans = intents.map((intent) => buildSearchPlanForIntent(keyword, intent));
  const candidates = new Map<string, GitHubRepoCandidate>();

  for (const plan of plans) {
    console.log(
      `[GitHub Discovery V3] keyword="${keyword}" search=${plan.intent} sort=${plan.sort} perPage=${plan.perPage}`,
    );
    const result = await fetchGithubSearchRepositories(plan.query, {
      sort: plan.sort,
      perPage: plan.perPage,
      delayMs: searchDelayMs,
    });
    if (!result.ok) {
      console.warn(
        `[GitHub Discovery V3] keyword="${keyword}" search=${plan.intent} failed: ${result.error}`,
      );
      continue;
    }
    for (const item of result.items) {
      const url = normalizeGitHubRepoUrl(item.html_url ?? "");
      if (url) {
        if (!candidates.has(url)) {
          candidates.set(url, { url, intent: plan.intent, repo: item });
        }
      }
    }
  }

  return [...candidates.values()];
}

export async function runGitHubKeywordDiscovery(
  keyword: string,
  options?: { intents?: GitHubV3Intent[]; searchDelayMs?: number },
): Promise<KeywordDiscoveryRunResult> {
  const intents = options?.intents?.length ? options.intents : DEFAULT_RUNTIME_CONFIG.intents;
  const searchDelayMs = Math.max(0, Math.floor(options?.searchDelayMs ?? DEFAULT_RUNTIME_CONFIG.searchDelayMs));
  const summary: GitHubKeywordDiscoverySummary = {
    keyword,
    byIntent: emptyIntentStats(),
    inserted: 0,
    skipped: 0,
    filtered: 0,
    invalid: 0,
    errors: 0,
    filterReasons: {},
  };
  const relatedSeeds: GitHubRelatedSeed[] = [];

  const candidates = await searchGitHubReposByKeyword(keyword, intents, searchDelayMs);
  if (candidates.length === 0) {
    console.log(`[GitHub Discovery V3] keyword="${keyword}" no candidate repos`);
    return { summary, relatedSeeds };
  }

  console.log(`[GitHub Discovery V3] keyword="${keyword}" candidates=${candidates.length}`);
  for (const candidate of candidates) {
    const { url, intent, repo } = candidate;
    try {
      const exists = await findDiscoveryItemByUrl(url);
      if (exists) {
        summary.skipped += 1;
        summary.byIntent[intent].skipped += 1;
        continue;
      }
      const filter = filterGithubRepository(repo);
      if (!filter.accepted) {
        summary.filtered += 1;
        summary.byIntent[intent].filtered += 1;
        summary.filterReasons[filter.reason] = (summary.filterReasons[filter.reason] ?? 0) + 1;
        continue;
      }
      await createDiscoveryItemFromGitHubUrlWithMeta(url, {
        description: repo.description ?? undefined,
        meta: {
          source: "github-v3",
          keyword,
          intent,
          stars: repo.stargazers_count ?? 0,
          lastUpdated: repo.pushed_at ?? null,
        },
      });
      summary.inserted += 1;
      summary.byIntent[intent].inserted += 1;
      if (repo.full_name) {
        relatedSeeds.push({ fullName: repo.full_name, keyword });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Invalid GitHub repo URL")) {
        summary.invalid += 1;
      } else {
        summary.errors += 1;
      }
      console.warn(`[GitHub Discovery V3] keyword="${keyword}" url="${url}" failed: ${msg}`);
    }
  }

  console.log(
    `[GitHub Discovery V3] keyword="${keyword}" inserted=${summary.inserted} filtered=${summary.filtered} skipped=${summary.skipped} invalid=${summary.invalid} errors=${summary.errors}`,
  );
  for (const intent of intents) {
    console.log(
      `[GitHub Discovery V3] keyword="${keyword}" ${intent}: inserted=${summary.byIntent[intent].inserted} filtered=${summary.byIntent[intent].filtered} skipped=${summary.byIntent[intent].skipped}`,
    );
  }
  return { summary, relatedSeeds };
}

async function enqueueTopicCandidates(
  topics: readonly string[],
  searchDelayMs: number,
  summary: {
    inserted: number;
    skipped: number;
    filtered: number;
    invalid: number;
    filterReasons: Partial<Record<GithubDiscoveryFilterReason, number>>;
    failedTopics: string[];
    bySource: Record<DiscoverySourceKind, DiscoveryStageStats>;
  },
): Promise<GitHubRelatedSeed[]> {
  const relatedSeeds: GitHubRelatedSeed[] = [];
  for (const topic of topics) {
    console.log(`[GitHub Discovery V3] processing topic="${topic}"`);
    try {
      const candidates = await searchGitHubReposByTopic(topic, searchDelayMs);
      for (const candidate of candidates) {
        const exists = await findDiscoveryItemByUrl(candidate.url);
        if (exists) {
          summary.skipped += 1;
          summary.bySource.topic.skipped += 1;
          continue;
        }
        const filter = filterGithubRepository(candidate.repo);
        if (!filter.accepted) {
          summary.filtered += 1;
          summary.bySource.topic.filtered += 1;
          recordFilterReason(summary.filterReasons, filter.reason);
          continue;
        }
        await createDiscoveryItemFromGitHubUrlWithMeta(candidate.url, {
          description: candidate.repo.description ?? undefined,
          meta: {
            source: "github-v3-topic",
            topic,
            intent: "topic",
            stars: candidate.repo.stargazers_count ?? 0,
            lastUpdated: candidate.repo.pushed_at ?? null,
          },
        });
        summary.inserted += 1;
        summary.bySource.topic.inserted += 1;
        if (candidate.repo.full_name) {
          relatedSeeds.push({ fullName: candidate.repo.full_name, keyword: topic });
        }
      }
    } catch (e) {
      summary.failedTopics.push(topic);
      console.error(`[GitHub Discovery V3] topic="${topic}" failed`, e);
    }
  }
  return relatedSeeds;
}

async function enqueueRelatedCandidates(
  seeds: GitHubRelatedSeed[],
  maxRelatedSeeds: number,
  searchDelayMs: number,
  summary: {
    inserted: number;
    skipped: number;
    filtered: number;
    invalid: number;
    filterReasons: Partial<Record<GithubDiscoveryFilterReason, number>>;
    bySource: Record<DiscoverySourceKind, DiscoveryStageStats>;
  },
): Promise<number> {
  const unique = new Map<string, GitHubRelatedSeed>();
  for (const s of seeds) {
    if (!unique.has(s.fullName)) {
      unique.set(s.fullName, s);
    }
  }
  const selected = [...unique.values()].slice(0, maxRelatedSeeds);
  if (selected.length === 0) {
    return 0;
  }
  const candidates = await searchGitHubRelatedRepos(selected, maxRelatedSeeds, searchDelayMs);
  for (const candidate of candidates) {
    const exists = await findDiscoveryItemByUrl(candidate.url);
    if (exists) {
      summary.skipped += 1;
      summary.bySource.related.skipped += 1;
      continue;
    }
    const filter = filterGithubRepository(candidate.repo);
    if (!filter.accepted) {
      summary.filtered += 1;
      summary.bySource.related.filtered += 1;
      recordFilterReason(summary.filterReasons, filter.reason);
      continue;
    }
    await createDiscoveryItemFromGitHubUrlWithMeta(candidate.url, {
      description: candidate.repo.description ?? undefined,
      meta: {
        source: "github-v3-related",
        seedRepo: candidate.seedRepo,
        intent: "related",
        query: candidate.query,
        stars: candidate.repo.stargazers_count ?? 0,
        lastUpdated: candidate.repo.pushed_at ?? null,
      },
    });
    summary.inserted += 1;
    summary.bySource.related.inserted += 1;
  }
  return selected.length;
}

export async function runGitHubDiscoveryV3(
  inputConfig?: Partial<GitHubDiscoveryV3RuntimeConfig>,
): Promise<GitHubDiscoveryV3Summary> {
  const runtimeConfig = sanitizeRuntimeConfig(inputConfig);
  const runtimeState = await readDiscoveryRuntimeState();
  const keywordBatch = selectKeywordsForRun(
    GITHUB_DISCOVERY_KEYWORDS,
    runtimeState.githubV3KeywordCursor,
    runtimeConfig.maxKeywordsPerRun,
  );
  const keywords = keywordBatch.selected;
  await updateGitHubV3KeywordCursor(keywordBatch.nextCursor);
  const topics = GITHUB_DISCOVERY_TOPICS.slice(0, runtimeConfig.maxTopicsPerRun);
  const startedAt = new Date().toISOString();
  const failedKeywords: string[] = [];
  const failedTopics: string[] = [];
  let inserted = 0;
  let skipped = 0;
  let filtered = 0;
  let invalid = 0;
  let relatedSeedsProcessed = 0;
  const byKeyword: Record<string, { inserted: number; filtered: number; skipped: number }> = {};
  const byIntent = emptyIntentStats();
  const bySource = emptyStageStats();
  const filterReasons: Partial<Record<GithubDiscoveryFilterReason, number>> = {};
  const relatedSeeds: GitHubRelatedSeed[] = [];

  console.log(`[GitHub Discovery V3] started at ${startedAt}`);
  console.log(
    `[GitHub Discovery V3] total keywords=${GITHUB_DISCOVERY_KEYWORDS.length} processed keywords=${keywords.length} maxKeywordsPerRun=${runtimeConfig.maxKeywordsPerRun} cursorStart=${keywordBatch.cursorStart} cursorEnd=${keywordBatch.cursorEnd} nextCursor=${keywordBatch.nextCursor}`,
  );
  console.log(`[GitHub Discovery V3] keywords selected=${JSON.stringify(keywords)}`);
  console.log(`[GitHub Discovery V3] intents used=${runtimeConfig.intents.join(", ")}`);

  for (const keyword of keywords) {
    console.log(`[GitHub Discovery V3] processing keyword="${keyword}"`);
    try {
      const { summary: result, relatedSeeds: seeds } = await runGitHubKeywordDiscovery(keyword, {
        intents: runtimeConfig.intents,
        searchDelayMs: runtimeConfig.searchDelayMs,
      });
      inserted += result.inserted;
      skipped += result.skipped + result.errors;
      filtered += result.filtered;
      invalid += result.invalid;
      bySource.keyword.inserted += result.inserted;
      bySource.keyword.filtered += result.filtered;
      bySource.keyword.skipped += result.skipped + result.errors;
      byKeyword[keyword] = {
        inserted: result.inserted,
        filtered: result.filtered,
        skipped: result.skipped + result.errors,
      };
      byIntent.active.inserted += result.byIntent.active.inserted;
      byIntent.active.filtered += result.byIntent.active.filtered;
      byIntent.active.skipped += result.byIntent.active.skipped;
      byIntent.new.inserted += result.byIntent.new.inserted;
      byIntent.new.filtered += result.byIntent.new.filtered;
      byIntent.new.skipped += result.byIntent.new.skipped;
      byIntent.popular.inserted += result.byIntent.popular.inserted;
      byIntent.popular.filtered += result.byIntent.popular.filtered;
      byIntent.popular.skipped += result.byIntent.popular.skipped;
      mergeReasonCounter(filterReasons, result.filterReasons);
      relatedSeeds.push(...seeds);
    } catch (e) {
      failedKeywords.push(keyword);
      console.error(`[GitHub Discovery V3] keyword="${keyword}" failed`, e);
    }
  }

  if (runtimeConfig.enableTopicDiscovery) {
    console.log(
      `[GitHub Discovery V3] topic discovery enabled: processing ${topics.length} topic(s)`,
    );
    const topicSeeds = await enqueueTopicCandidates(topics, runtimeConfig.searchDelayMs, {
      inserted,
      skipped,
      filtered,
      invalid,
      filterReasons,
      failedTopics,
      bySource,
    });
    relatedSeeds.push(...topicSeeds);
    // Re-sync scalar counters from mutable object pattern not used; recalc from bySource + invalid.
    inserted = bySource.keyword.inserted + bySource.topic.inserted + bySource.related.inserted;
    filtered = bySource.keyword.filtered + bySource.topic.filtered + bySource.related.filtered;
    skipped = bySource.keyword.skipped + bySource.topic.skipped + bySource.related.skipped;
  } else {
    console.log("[GitHub Discovery V3] topic discovery skipped by config");
  }

  if (runtimeConfig.enableRelatedDiscovery) {
    console.log(
      `[GitHub Discovery V3] related discovery enabled: seed candidates=${relatedSeeds.length} maxRelatedSeeds=${runtimeConfig.maxRelatedSeeds}`,
    );
    relatedSeedsProcessed = await enqueueRelatedCandidates(
      relatedSeeds,
      runtimeConfig.maxRelatedSeeds,
      runtimeConfig.searchDelayMs,
      { inserted, skipped, filtered, invalid, filterReasons, bySource },
    );
    inserted = bySource.keyword.inserted + bySource.topic.inserted + bySource.related.inserted;
    filtered = bySource.keyword.filtered + bySource.topic.filtered + bySource.related.filtered;
    skipped = bySource.keyword.skipped + bySource.topic.skipped + bySource.related.skipped;
  } else {
    console.log("[GitHub Discovery V3] related discovery skipped by config");
  }

  const finishedAt = new Date().toISOString();
  const summary: GitHubDiscoveryV3Summary = {
    startedAt,
    finishedAt,
    totalKeywords: GITHUB_DISCOVERY_KEYWORDS.length,
    keywordsProcessed: keywords.length,
    maxKeywordsPerRun: runtimeConfig.maxKeywordsPerRun,
    keywordCursorStart: keywordBatch.cursorStart,
    keywordCursorEnd: keywordBatch.cursorEnd,
    nextKeywordCursor: keywordBatch.nextCursor,
    keywordsSelected: keywords,
    intentsUsed: runtimeConfig.intents,
    truncatedByMaxKeywordsPerRun: keywords.length < GITHUB_DISCOVERY_KEYWORDS.length,
    topicsProcessed: runtimeConfig.enableTopicDiscovery ? topics.length : 0,
    relatedSeedsProcessed,
    inserted,
    skipped,
    filtered,
    invalid,
    bySource,
    byKeyword,
    byIntent,
    filterReasons,
    failedKeywords,
    failedTopics,
  };
  console.log(
    `[GitHub Discovery V3] finished at ${finishedAt} totalKeywords=${summary.totalKeywords} keywordsProcessed=${summary.keywordsProcessed} keywordCursorStart=${summary.keywordCursorStart} keywordCursorEnd=${summary.keywordCursorEnd} nextKeywordCursor=${summary.nextKeywordCursor} topicsProcessed=${summary.topicsProcessed} relatedSeedsProcessed=${summary.relatedSeedsProcessed} inserted=${inserted} filtered=${filtered} skipped=${skipped} invalid=${invalid} failedKeywords=${failedKeywords.length} failedTopics=${failedTopics.length}`,
  );
  try {
    await appendGitHubV3DiscoveryRunHistory(summary);
  } catch (e) {
    console.warn("[GitHub Discovery V3] failed to persist run history", e);
  }
  return summary;
}
