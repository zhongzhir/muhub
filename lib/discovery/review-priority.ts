function asObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

function nonEmpty(s: string | null | undefined): boolean {
  return Boolean(s?.trim());
}

function log10p(n: number): number {
  return Math.log10(1 + Math.max(0, n));
}

export type ReviewPriorityFactor = {
  id: string;
  label: string;
  points: number;
};

export type ReviewPrioritySignals = {
  version: 1;
  total: number;
  multiSource: boolean;
  contributingLabels: string[];
  productHuntFused: boolean;
  productHunt?: {
    votes: number | null;
    snapshotCount: number;
    lastSyncIso: string | null;
  };
  factors: ReviewPriorityFactor[];
};

export type ReviewPriorityComputeInput = {
  externalType: string;
  sourceKey: string | null;
  metadataJson: unknown;
  website: string | null;
  repoUrl: string | null;
  docsUrl: string | null;
  enrichmentStatus: string;
  classificationStatus: string;
  isAiRelated: boolean | null;
  score: number | null;
  qualityScore: number | null;
  stars: number;
  repoUpdatedAt: Date | null;
  lastCommitAt: Date | null;
  reviewStatus: string;
  importStatus: string;
};

function sourceKeyFamily(key: string | null): "github" | "producthunt" | "other" {
  const k = (key ?? "").toLowerCase();
  if (k.startsWith("github")) {
    return "github";
  }
  if (k.startsWith("producthunt")) {
    return "producthunt";
  }
  return "other";
}

/** 从 metadataJson.productHunt 解析投票与快照（含并入 GitHub 行时的补充） */
export function parseProductHuntMeta(metadataJson: unknown): {
  votes: number | null;
  snapshotCount: number;
  lastAt: string | null;
} {
  const ph = asObject(asObject(metadataJson).productHunt);
  if (Object.keys(ph).length === 0) {
    return { votes: null, snapshotCount: 0, lastAt: null };
  }
  let votes: number | null = null;
  if (typeof ph.votesCount === "number") {
    votes = ph.votesCount;
  }
  const snaps = Array.isArray(ph.snapshots) ? ph.snapshots : [];
  if (votes == null && snaps.length) {
    const last = snaps[snaps.length - 1];
    if (last && typeof last === "object" && last !== null && "votes" in last) {
      const v = (last as { votes?: unknown }).votes;
      if (typeof v === "number") {
        votes = v;
      }
    }
  }
  let lastAt: string | null = null;
  for (let i = snaps.length - 1; i >= 0; i--) {
    const s = snaps[i];
    if (s && typeof s === "object" && s !== null && typeof (s as { at?: unknown }).at === "string") {
      lastAt = (s as { at: string }).at;
      break;
    }
  }
  return { votes, snapshotCount: snaps.length, lastAt };
}

/**
 * 多来源与 Product Hunt 融合（含 GitHub 行上挂的 productHunt metadata）。
 */
export function buildDiscoveryFusionSummary(row: {
  externalType: string;
  sourceKey: string | null;
  metadataJson: unknown;
  repoUrl: string | null;
}): Pick<
  ReviewPrioritySignals,
  "multiSource" | "contributingLabels" | "productHuntFused" | "productHunt"
> {
  const ext = row.externalType.toLowerCase();
  const labels = new Set<string>();

  const fam = sourceKeyFamily(row.sourceKey);
  if (fam === "github") {
    labels.add("GitHub");
  } else if (fam === "producthunt") {
    labels.add("Product Hunt");
  } else if (fam === "other" && row.sourceKey?.trim()) {
    labels.add("其他来源");
  }

  if (ext === "github") {
    labels.add("GitHub");
  }
  if (ext === "producthunt_product") {
    labels.add("Product Hunt");
  }
  if (nonEmpty(row.repoUrl)) {
    labels.add("GitHub");
  }

  const phMeta = parseProductHuntMeta(row.metadataJson);
  const phObj = asObject(asObject(row.metadataJson).productHunt);
  const hasPhBlock =
    phMeta.snapshotCount > 0 ||
    phMeta.votes != null ||
    typeof phObj.postId === "string" ||
    typeof phObj.url === "string";

  if (hasPhBlock) {
    labels.add("Product Hunt");
  }

  const productHuntFused = hasPhBlock && (ext === "github" || Boolean(nonEmpty(row.repoUrl)));

  const contributingLabels = [...labels].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const multiSource = contributingLabels.length >= 2 || productHuntFused;

  return {
    multiSource,
    contributingLabels,
    productHuntFused,
    productHunt:
      hasPhBlock || phMeta.votes != null
        ? {
            votes: phMeta.votes,
            snapshotCount: phMeta.snapshotCount,
            lastSyncIso: phMeta.lastAt,
          }
        : undefined,
  };
}

export function computeReviewPriority(input: ReviewPriorityComputeInput): {
  reviewPriorityScore: number;
  reviewPrioritySignals: ReviewPrioritySignals;
} {
  const factors: ReviewPriorityFactor[] = [];
  const fusion = buildDiscoveryFusionSummary({
    externalType: input.externalType,
    sourceKey: input.sourceKey,
    metadataJson: input.metadataJson,
    repoUrl: input.repoUrl,
  });

  if (fusion.multiSource) {
    factors.push({ id: "multi_source", label: "多来源 / PH 已融合", points: 38 });
  }

  if (nonEmpty(input.website)) {
    factors.push({ id: "website", label: "有官网", points: 14 });
  }
  if (nonEmpty(input.repoUrl)) {
    factors.push({ id: "repo", label: "有 GitHub/仓库", points: 16 });
  }
  if (nonEmpty(input.docsUrl)) {
    factors.push({ id: "docs", label: "有文档链", points: 10 });
  }

  if (input.enrichmentStatus === "OK") {
    factors.push({ id: "enrichment_ok", label: "Enrichment 成功", points: 12 });
  } else if (input.enrichmentStatus === "FAILED") {
    factors.push({ id: "enrichment_fail", label: "Enrichment 失败", points: -6 });
  }

  if (input.classificationStatus === "ACCEPTED") {
    factors.push({ id: "class_accepted", label: "分类已接受", points: 20 });
  } else if (input.classificationStatus === "DONE") {
    factors.push({ id: "class_done", label: "分类已完成", points: 10 });
  } else if (input.classificationStatus === "FAILED") {
    factors.push({ id: "class_fail", label: "分类失败", points: -4 });
  }

  if (input.isAiRelated === true) {
    factors.push({ id: "ai_related", label: "AI 相关", points: 10 });
  }

  const baseScore = input.score ?? 0;
  const quality = input.qualityScore ?? 0;
  const qPts = Math.round(Math.min(18, baseScore * 0.12 + quality * 0.1));
  if (qPts > 0) {
    factors.push({
      id: "quality_scores",
      label: `质量分合成 (+${qPts})`,
      points: qPts,
    });
  }

  const starPts = Math.round(Math.min(22, log10p(input.stars) * 9));
  if (starPts > 0) {
    factors.push({ id: "stars", label: `Stars 热度 (+${starPts})`, points: starPts });
  }

  const ref =
    input.repoUpdatedAt?.getTime() ?? input.lastCommitAt?.getTime() ?? null;
  if (ref != null) {
    const days = (Date.now() - ref) / (86400000);
    if (days <= 90) {
      factors.push({ id: "recent_activity", label: "近期有更新", points: 12 });
    } else if (days <= 365) {
      factors.push({ id: "somewhat_fresh", label: "一年内曾更新", points: 4 });
    }
  }

  const phVotes = fusion.productHunt?.votes;
  if (typeof phVotes === "number" && phVotes > 0) {
    const vPts = Math.round(Math.min(16, log10p(phVotes) * 7));
    factors.push({
      id: "ph_votes",
      label: `PH 投票 (+${vPts})`,
      points: vPts,
    });
  }

  let total = factors.reduce((s, f) => s + f.points, 0);
  total = Math.max(0, Math.round(total * 10) / 10);

  if (input.reviewStatus === "REJECTED" || input.reviewStatus === "IGNORED") {
    total = Math.min(total, 6);
  } else if (input.importStatus === "IMPORTED" || input.reviewStatus === "MERGED") {
    total = Math.min(total, 10);
  }

  const signals: ReviewPrioritySignals = {
    version: 1,
    total, // 与 reviewPriorityScore 一致（已含拒绝/导入降权）
    multiSource: fusion.multiSource,
    contributingLabels: fusion.contributingLabels,
    productHuntFused: fusion.productHuntFused,
    productHunt: fusion.productHunt,
    factors,
  };

  return {
    reviewPriorityScore: total,
    reviewPrioritySignals: signals,
  };
}
