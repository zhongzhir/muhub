const RELEVANCE_KWS = [
  "ai",
  "agent",
  "llm",
  "workflow",
  "rag",
  "tool",
  "mcp",
  "gpt",
  "open-source",
  "opensource",
  "embedding",
  "vector",
  "automation",
] as const;

export type ScoreDiscoveryCandidateInput = {
  title: string;
  summary: string | null;
  descriptionRaw: string | null;
  website: string | null;
  tags: string[];
  stars: number;
  forks: number;
  watchers: number;
  hasAvatar: boolean;
  repoUpdatedAt: Date | null;
  lastCommitAt: Date | null;
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(100, x));
}

function log10p(n: number): number {
  return Math.log10(1 + Math.max(0, n));
}

/** 子项与总分均为 0–100，总分加权合成 */
export function scoreDiscoveryCandidate(input: ScoreDiscoveryCandidateInput): {
  score: number;
  popularityScore: number;
  freshnessScore: number;
  qualityScore: number;
} {
  const popularityScore = clamp01(
    log10p(input.stars) * 28 + log10p(input.forks) * 18 + log10p(input.watchers) * 12,
  );

  const ref =
    input.repoUpdatedAt?.getTime() ??
    input.lastCommitAt?.getTime() ??
    null;
  let freshnessScore = 40;
  if (ref != null) {
    const days = (Date.now() - ref) / (24 * 60 * 60 * 1000);
    freshnessScore = clamp01(100 - Math.min(days, 365) * (80 / 365));
  }

  let qualityScore = 0;
  if (input.descriptionRaw?.trim()) {
    qualityScore += 28;
  }
  if (input.website?.trim()) {
    qualityScore += 28;
  }
  if (input.tags.length > 0) {
    qualityScore += 24;
  }
  if (input.hasAvatar) {
    qualityScore += 20;
  }
  qualityScore = clamp01(qualityScore);

  const blob =
    `${input.title}\n${input.summary ?? ""}\n${input.descriptionRaw ?? ""}\n${input.tags.join(" ")}`.toLowerCase();
  let rel = 0;
  for (const kw of RELEVANCE_KWS) {
    if (blob.includes(kw)) {
      rel += 7;
    }
  }
  const relevanceScore = clamp01(rel);

  const score = clamp01(
    popularityScore * 0.38 + freshnessScore * 0.27 + qualityScore * 0.25 + relevanceScore * 0.1,
  );

  return {
    score: Math.round(score * 100) / 100,
    popularityScore: Math.round(popularityScore * 100) / 100,
    freshnessScore: Math.round(freshnessScore * 100) / 100,
    qualityScore: Math.round(qualityScore * 100) / 100,
  };
}

export function tagsFromJson(tagsJson: unknown): string[] {
  if (!Array.isArray(tagsJson)) {
    return [];
  }
  return tagsJson
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter(Boolean)
    .slice(0, 64);
}
