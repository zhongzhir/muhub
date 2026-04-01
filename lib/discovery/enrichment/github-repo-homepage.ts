import { githubDiscoveryHeaders } from "@/lib/discovery/github/http";
import type { EnrichmentPlatform } from "@/lib/discovery/enrichment/classify-platform";
import { classifyEnrichmentPlatform } from "@/lib/discovery/enrichment/classify-platform";
import {
  hostFromNormalizedUrl,
  normalizeEnrichmentUrl,
} from "@/lib/discovery/enrichment/url-utils";
import { parseGithubOwnerRepoFromUrl } from "@/lib/discovery/enrichment/github-repo-parse";

export type EnrichmentExtract = {
  url: string;
  platform: EnrichmentPlatform;
  source: string;
  confidence: number;
  evidenceText?: string;
};

/** GitHub API：仓库 homepage 字段（高置信度）。 */
export async function enrichFromGithubRepoHomepage(
  repoUrl: string,
  logs: string[],
): Promise<EnrichmentExtract[]> {
  const parsed = parseGithubOwnerRepoFromUrl(repoUrl);
  if (!parsed) {
    logs.push("[github-homepage] skip: invalid repo url");
    return [];
  }
  const { owner, repo } = parsed;
  const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const res = await fetch(api, { headers: githubDiscoveryHeaders(), cache: "no-store" });
  if (!res.ok) {
    logs.push(`[github-homepage] API ${res.status}`);
    return [];
  }
  const j = (await res.json()) as { homepage?: string | null };
  const hp = j.homepage?.trim();
  if (!hp) {
    logs.push("[github-homepage] empty homepage");
    return [];
  }
  const norm = normalizeEnrichmentUrl(hp);
  if (!norm) {
    logs.push("[github-homepage] invalid homepage url");
    return [];
  }
  const plat = classifyEnrichmentPlatform(norm) ?? "website";
  logs.push(`[github-homepage] ok ${hostFromNormalizedUrl(norm)}`);
  return [
    {
      url: norm,
      platform: plat,
      source: "github-repo-homepage",
      confidence: 0.95,
      evidenceText: "package.json / repo homepage",
    },
  ];
}
