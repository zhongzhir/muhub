import { GITHUB_DISCOVERY_SEARCH_TASKS } from "@/agents/discovery/github-filters";
import { fetchGithubSearchRepositories } from "@/agents/discovery/github-search";
import {
  normalizeGithubSearchItem,
  type NormalizedDiscoveryCandidate,
} from "@/agents/discovery/github-normalize";
import { upsertDiscoveredProjectCandidates } from "@/lib/discovery-candidates";

async function main() {
  const seen = new Set<string>();
  const normalized: NormalizedDiscoveryCandidate[] = [];
  let fetchedRaw = 0;

  for (const task of GITHUB_DISCOVERY_SEARCH_TASKS) {
    const res = await fetchGithubSearchRepositories(task.query, {
      sort: task.sort,
      perPage: task.perPage,
    });
    if (!res.ok) {
      console.error(`[discovery] source=${task.source} error=${res.error}`);
      continue;
    }
    fetchedRaw += res.items.length;
    for (const it of res.items) {
      const n = normalizeGithubSearchItem(it, task.source);
      if (!n) {
        continue;
      }
      const key = `${n.source}:${n.sourceId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      normalized.push(n);
    }
  }

  console.info(`[discovery] fetched ${fetchedRaw} repos from github`);
  console.info(`[discovery] normalized ${normalized.length} candidates`);

  if (normalized.length === 0) {
    console.info("[discovery] upserted 0 candidates (nothing to write)");
    console.info("[discovery] done");
    return;
  }

  const { upserted } = await upsertDiscoveredProjectCandidates(normalized);
  console.info(`[discovery] upserted ${upserted} candidates`);
  console.info("[discovery] done");
}

main().catch((e) => {
  console.error("[discovery] fatal", e);
  process.exit(1);
});
