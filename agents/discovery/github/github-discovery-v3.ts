import { fetchGithubSearchRepositories } from "../github-search";
import type { GithubRepoSearchItem } from "../github-search";
import { createDiscoveryItemFromGitHubUrlWithMeta } from "./github-discovery";
import { findDiscoveryItemByUrl } from "../discovery-store";
import { GITHUB_DISCOVERY_KEYWORDS } from "./github-discovery-keywords";
import {
  filterGithubRepository,
  type GithubDiscoveryFilterReason,
} from "./github-discovery-filter";
import { normalizeGitHubRepoUrl } from "./github-utils";

type GitHubSearchIntent = "active" | "new" | "popular";

type GitHubSearchPlan = {
  intent: GitHubSearchIntent;
  query: string;
  sort: "updated" | "stars";
  perPage: number;
};

type GitHubRepoCandidate = {
  url: string;
  intent: GitHubSearchIntent;
  repo: GithubRepoSearchItem;
};

export type GitHubKeywordDiscoverySummary = {
  keyword: string;
  byIntent: Record<GitHubSearchIntent, { inserted: number; filtered: number; skipped: number }>;
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
  keywordsProcessed: number;
  inserted: number;
  skipped: number;
  filtered: number;
  invalid: number;
  byKeyword: Record<string, { inserted: number; filtered: number; skipped: number }>;
  byIntent: Record<GitHubSearchIntent, { inserted: number; filtered: number; skipped: number }>;
  filterReasons: Partial<Record<GithubDiscoveryFilterReason, number>>;
  failedKeywords: string[];
};

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function buildSearchPlansForKeyword(keyword: string): GitHubSearchPlan[] {
  const pushedAfter = isoDaysAgo(90);
  const createdAfter = isoDaysAgo(60);
  return [
    {
      intent: "active",
      query: `${keyword} stars:>10 pushed:>${pushedAfter}`,
      sort: "updated",
      perPage: 20,
    },
    {
      intent: "new",
      query: `${keyword} created:>${createdAfter} stars:>3`,
      sort: "updated",
      perPage: 20,
    },
    {
      intent: "popular",
      query: `${keyword} stars:>80`,
      sort: "stars",
      perPage: 20,
    },
  ];
}

function emptyIntentStats(): Record<GitHubSearchIntent, { inserted: number; filtered: number; skipped: number }> {
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

export async function searchGitHubReposByKeyword(keyword: string): Promise<GitHubRepoCandidate[]> {
  const plans = buildSearchPlansForKeyword(keyword);
  const candidates = new Map<string, GitHubRepoCandidate>();

  for (const plan of plans) {
    console.log(
      `[GitHub Discovery V3] keyword="${keyword}" search=${plan.intent} sort=${plan.sort} perPage=${plan.perPage}`,
    );
    const result = await fetchGithubSearchRepositories(plan.query, {
      sort: plan.sort,
      perPage: plan.perPage,
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
): Promise<GitHubKeywordDiscoverySummary> {
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

  const candidates = await searchGitHubReposByKeyword(keyword);
  if (candidates.length === 0) {
    console.log(`[GitHub Discovery V3] keyword="${keyword}" no candidate repos`);
    return summary;
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
  console.log(
    `[GitHub Discovery V3] keyword="${keyword}" active: inserted=${summary.byIntent.active.inserted} filtered=${summary.byIntent.active.filtered}`,
  );
  console.log(
    `[GitHub Discovery V3] keyword="${keyword}" new: inserted=${summary.byIntent.new.inserted} filtered=${summary.byIntent.new.filtered}`,
  );
  console.log(
    `[GitHub Discovery V3] keyword="${keyword}" popular: inserted=${summary.byIntent.popular.inserted} filtered=${summary.byIntent.popular.filtered}`,
  );
  return summary;
}

export async function runGitHubDiscoveryV3(): Promise<GitHubDiscoveryV3Summary> {
  const startedAt = new Date().toISOString();
  const failedKeywords: string[] = [];
  let inserted = 0;
  let skipped = 0;
  let filtered = 0;
  let invalid = 0;
  const byKeyword: Record<string, { inserted: number; filtered: number; skipped: number }> = {};
  const byIntent = emptyIntentStats();
  const filterReasons: Partial<Record<GithubDiscoveryFilterReason, number>> = {};

  console.log(`[GitHub Discovery V3] started at ${startedAt}`);

  for (const keyword of GITHUB_DISCOVERY_KEYWORDS) {
    console.log(`[GitHub Discovery V3] processing keyword="${keyword}"`);
    try {
      const result = await runGitHubKeywordDiscovery(keyword);
      inserted += result.inserted;
      skipped += result.skipped + result.errors;
      filtered += result.filtered;
      invalid += result.invalid;
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
    } catch (e) {
      failedKeywords.push(keyword);
      console.error(`[GitHub Discovery V3] keyword="${keyword}" failed`, e);
    }
  }

  const finishedAt = new Date().toISOString();
  const summary: GitHubDiscoveryV3Summary = {
    startedAt,
    finishedAt,
    keywordsProcessed: GITHUB_DISCOVERY_KEYWORDS.length,
    inserted,
    skipped,
    filtered,
    invalid,
    byKeyword,
    byIntent,
    filterReasons,
    failedKeywords,
  };
  console.log(
    `[GitHub Discovery V3] finished at ${finishedAt} keywords=${summary.keywordsProcessed} inserted=${inserted} filtered=${filtered} skipped=${skipped} invalid=${invalid} failedKeywords=${failedKeywords.length}`,
  );
  return summary;
}
