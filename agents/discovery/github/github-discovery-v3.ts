import { fetchGithubSearchRepositories } from "../github-search";
import { createDiscoveryItemFromGitHubUrl } from "./github-discovery";
import { findDiscoveryItemByUrl } from "../discovery-store";
import { GITHUB_DISCOVERY_KEYWORDS } from "./github-discovery-keywords";
import { normalizeGitHubRepoUrl } from "./github-utils";

type GitHubSearchIntent = "active" | "new" | "popular";

type GitHubSearchPlan = {
  intent: GitHubSearchIntent;
  query: string;
  sort: "updated" | "stars";
  perPage: number;
};

export type GitHubKeywordDiscoverySummary = {
  keyword: string;
  inserted: number;
  skipped: number;
  invalid: number;
  errors: number;
};

export type GitHubDiscoveryV3Summary = {
  startedAt: string;
  finishedAt: string;
  keywordsProcessed: number;
  inserted: number;
  skipped: number;
  invalid: number;
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

export async function searchGitHubReposByKeyword(keyword: string): Promise<string[]> {
  const plans = buildSearchPlansForKeyword(keyword);
  const urls = new Set<string>();

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
        urls.add(url);
      }
    }
  }

  return [...urls];
}

export async function runGitHubKeywordDiscovery(
  keyword: string,
): Promise<GitHubKeywordDiscoverySummary> {
  const summary: GitHubKeywordDiscoverySummary = {
    keyword,
    inserted: 0,
    skipped: 0,
    invalid: 0,
    errors: 0,
  };

  const urls = await searchGitHubReposByKeyword(keyword);
  if (urls.length === 0) {
    console.log(`[GitHub Discovery V3] keyword="${keyword}" no candidate repos`);
    return summary;
  }

  console.log(`[GitHub Discovery V3] keyword="${keyword}" candidates=${urls.length}`);
  for (const url of urls) {
    try {
      const exists = await findDiscoveryItemByUrl(url);
      if (exists) {
        summary.skipped += 1;
        continue;
      }
      await createDiscoveryItemFromGitHubUrl(url);
      summary.inserted += 1;
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
    `[GitHub Discovery V3] keyword="${keyword}" inserted=${summary.inserted} skipped=${summary.skipped} invalid=${summary.invalid} errors=${summary.errors}`,
  );
  return summary;
}

export async function runGitHubDiscoveryV3(): Promise<GitHubDiscoveryV3Summary> {
  const startedAt = new Date().toISOString();
  const failedKeywords: string[] = [];
  let inserted = 0;
  let skipped = 0;
  let invalid = 0;

  console.log(`[GitHub Discovery V3] started at ${startedAt}`);

  for (const keyword of GITHUB_DISCOVERY_KEYWORDS) {
    console.log(`[GitHub Discovery V3] processing keyword="${keyword}"`);
    try {
      const result = await runGitHubKeywordDiscovery(keyword);
      inserted += result.inserted;
      skipped += result.skipped + result.errors;
      invalid += result.invalid;
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
    invalid,
    failedKeywords,
  };
  console.log(
    `[GitHub Discovery V3] finished at ${finishedAt} keywords=${summary.keywordsProcessed} inserted=${inserted} skipped=${skipped} invalid=${invalid} failedKeywords=${failedKeywords.length}`,
  );
  return summary;
}
