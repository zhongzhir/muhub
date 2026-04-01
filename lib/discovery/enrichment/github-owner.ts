import { githubDiscoveryHeaders } from "@/lib/discovery/github/http";
import { classifyEnrichmentPlatform } from "@/lib/discovery/enrichment/classify-platform";
import {
  hostFromNormalizedUrl,
  normalizeEnrichmentUrl,
} from "@/lib/discovery/enrichment/url-utils";
import type { EnrichmentExtract } from "@/lib/discovery/enrichment/github-repo-homepage";

type GhProfile = {
  blog?: string | null;
  twitter_username?: string | null;
};

async function fetchGithubProfile(login: string, logs: string[]): Promise<GhProfile | null> {
  const u = `https://api.github.com/users/${encodeURIComponent(login)}`;
  const res = await fetch(u, { headers: githubDiscoveryHeaders(), cache: "no-store" });
  if (res.ok) {
    return (await res.json()) as GhProfile;
  }
  if (res.status === 404) {
    const o = `https://api.github.com/orgs/${encodeURIComponent(login)}`;
    const res2 = await fetch(o, { headers: githubDiscoveryHeaders(), cache: "no-store" });
    if (res2.ok) {
      logs.push("[owner] resolved as org");
      return (await res2.json()) as GhProfile;
    }
    logs.push(`[owner] org API ${res2.status}`);
    return null;
  }
  logs.push(`[owner] users API ${res.status}`);
  return null;
}

/** GitHub users/orgs API：blog、twitter_username。 */
export async function enrichFromGithubOwner(
  ownerName: string | null | undefined,
  logs: string[],
): Promise<EnrichmentExtract[]> {
  const login = ownerName?.trim();
  if (!login) {
    logs.push("[owner] skip: no ownerName");
    return [];
  }

  const profile = await fetchGithubProfile(login, logs);
  if (!profile) {
    return [];
  }

  const out: EnrichmentExtract[] = [];

  const blog = profile.blog?.trim();
  if (blog) {
    const raw = /^https?:\/\//i.test(blog) ? blog : `https://${blog}`;
    const norm = normalizeEnrichmentUrl(raw);
    if (norm) {
      const plat = classifyEnrichmentPlatform(norm) ?? "website";
      out.push({
        url: norm,
        platform: plat,
        source: "github-owner-api",
        confidence: plat === "blog" || plat === "docs" ? 0.9 : 0.88,
        evidenceText: `GH profile blog ${hostFromNormalizedUrl(norm)}`,
      });
    }
  }

  const tw = profile.twitter_username?.trim();
  if (tw) {
    const norm = normalizeEnrichmentUrl(`https://x.com/${tw.replace(/^@/, "")}`);
    if (norm) {
      out.push({
        url: norm,
        platform: "twitter",
        source: "github-owner-api",
        confidence: 0.9,
        evidenceText: "twitter_username",
      });
    }
  }

  logs.push(`[owner] extracted ${out.length} from API`);
  return out;
}
