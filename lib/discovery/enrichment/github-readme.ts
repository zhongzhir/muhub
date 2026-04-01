import { githubDiscoveryHeaders } from "@/lib/discovery/github/http";
import type { EnrichmentPlatform } from "@/lib/discovery/enrichment/classify-platform";
import { classifyEnrichmentPlatform } from "@/lib/discovery/enrichment/classify-platform";
import {
  hostFromNormalizedUrl,
  normalizeEnrichmentUrl,
} from "@/lib/discovery/enrichment/url-utils";
import { parseGithubOwnerRepoFromUrl } from "@/lib/discovery/enrichment/github-repo-parse";
import type { EnrichmentExtract } from "@/lib/discovery/enrichment/github-repo-homepage";

const DOC_CTX = /documentation|docs?|guide|手册|handbook|manual|read\s*the\s*docs/i;

function skipGithubNoiseHost(host: string): boolean {
  return (
    host === "github.com" ||
    host.endsWith(".github.com") ||
    host === "gist.github.com"
  );
}

/** 从 README Markdown 抽链接（含 “Documentation” 等上下文加权）。 */
export async function enrichFromGithubReadme(
  repoUrl: string,
  logs: string[],
): Promise<EnrichmentExtract[]> {
  const parsed = parseGithubOwnerRepoFromUrl(repoUrl);
  if (!parsed) {
    logs.push("[readme] skip: invalid repo url");
    return [];
  }
  const { owner, repo } = parsed;
  const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`;
  const res = await fetch(api, { headers: githubDiscoveryHeaders(), cache: "no-store" });
  if (!res.ok) {
    logs.push(`[readme] API ${res.status}`);
    return [];
  }
  const j = (await res.json()) as { content?: string; encoding?: string };
  if (j.encoding !== "base64" || typeof j.content !== "string") {
    logs.push("[readme] no readme body");
    return [];
  }
  const text = Buffer.from(j.content.replace(/\n/g, ""), "base64")
    .toString("utf8")
    .slice(0, 800_000);

  const seen = new Set<string>();
  const out: EnrichmentExtract[] = [];

  const mdLink = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = mdLink.exec(text)) !== null) {
    const label = m[1];
    const raw = m[2].trim();
    const norm = normalizeEnrichmentUrl(raw);
    if (!norm || seen.has(norm)) {
      continue;
    }
    const host = hostFromNormalizedUrl(norm);
    if (host && skipGithubNoiseHost(host)) {
      continue;
    }
    const plat = classifyEnrichmentPlatform(norm);
    if (!plat) {
      continue;
    }
    seen.add(norm);
    const ctxChunk = text.slice(Math.max(0, m.index - 160), m.index + 160);
    const hiCtx = DOC_CTX.test(label) || DOC_CTX.test(ctxChunk);
    let confidence = 0.65;
    if (plat === "docs" && hiCtx) {
      confidence = 0.9;
    } else if (plat === "docs") {
      confidence = 0.78;
    } else if (hiCtx && /discord|twitter|x\.com|telegram|youtube/i.test(label + ctxChunk)) {
      confidence = 0.72;
    }
    out.push({
      url: norm,
      platform: plat,
      source: "github-readme",
      confidence,
      evidenceText: label.slice(0, 120) || undefined,
    });
  }

  const bare = /\bhttps?:\/\/[^\s\])>'"<]+/gi;
  let b: RegExpExecArray | null;
  while ((b = bare.exec(text)) !== null) {
    const norm = normalizeEnrichmentUrl(b[0]);
    if (!norm || seen.has(norm)) {
      continue;
    }
    const host = hostFromNormalizedUrl(norm);
    if (host && skipGithubNoiseHost(host)) {
      continue;
    }
    const plat = classifyEnrichmentPlatform(norm) as EnrichmentPlatform | null;
    if (!plat) {
      continue;
    }
    seen.add(norm);
    const ctxChunk = text.slice(Math.max(0, b.index - 80), b.index + 80);
    const hiCtx = DOC_CTX.test(ctxChunk);
    let confidence = 0.6;
    if (plat === "docs" && hiCtx) {
      confidence = 0.85;
    }
    out.push({
      url: norm,
      platform: plat,
      source: "github-readme",
      confidence,
    });
  }

  logs.push(`[readme] extracted ${out.length} links`);
  return out;
}
