import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type LearningAnalyticsRow = {
  sourceKey: string;
  sourceName: string;
  signalCount: number;
  entityCount: number;
  acceptCount: number;
  rejectCount: number;
  mergeCount: number;
  acceptRate: number;
  rejectRate: number;
  topRejectReasons: Array<{ tag: string; count: number }>;
};

export type EntityTypeAnalyticsRow = {
  entityType: string;
  count: number;
  accepted: number;
  rejected: number;
  acceptRate: number;
  topRejectReasons: Array<{ tag: string; count: number }>;
};

export type DiscoveryLearningAnalytics = {
  sourcePerformance: LearningAnalyticsRow[];
  entityTypePerformance: EntityTypeAnalyticsRow[];
  noisePatterns: Array<{ tag: string; count: number }>;
  suggestions: string[];
};

type FeedbackJoinedRow = {
  sourceKey: string | null;
  sourceName: string | null;
  signalId: string | null;
  entityHintId: string | null;
  entityType: string | null;
  decision: string;
  reasonTags: Prisma.JsonValue | null;
};

function tagsFromJson(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value)
    ? value.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    : [];
}

function topTags(map: Map<string, number>, limit = 8): Array<{ tag: string; count: number }> {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

export async function readDiscoveryLearningAnalytics(): Promise<DiscoveryLearningAnalytics> {
  const rows = await prisma.$queryRaw<FeedbackJoinedRow[]>`
    SELECT
      ds."key" AS "sourceKey",
      ds."name" AS "sourceName",
      sig."id" AS "signalId",
      eh."id" AS "entityHintId",
      COALESCE(df."finalEntityType", eh."entityType") AS "entityType",
      df."decision" AS "decision",
      df."reasonTags" AS "reasonTags"
    FROM "DiscoveryFeedback" df
    LEFT JOIN "EntityHint" eh ON eh."id" = df."entityHintId"
    LEFT JOIN "DiscoverySignal" sig ON sig."id" = eh."sourceSignalId"
    LEFT JOIN "DiscoverySource" ds ON ds."id" = sig."sourceId"
    WHERE df."isHumanDecision" = true
      AND COALESCE(df."decisionSource", '') <> 'system_rule'
    ORDER BY df."createdAt" DESC
    LIMIT 2000
  `;

  const sourceMap = new Map<
    string,
    {
      sourceKey: string;
      sourceName: string;
      signalIds: Set<string>;
      entityIds: Set<string>;
      accept: number;
      reject: number;
      merge: number;
      rejectReasons: Map<string, number>;
    }
  >();
  const typeMap = new Map<
    string,
    {
      entityType: string;
      count: number;
      accepted: number;
      rejected: number;
      rejectReasons: Map<string, number>;
    }
  >();
  const noiseMap = new Map<string, number>();
  const noiseTags = new Set([
    "sentence_fragment",
    "generic_organization",
    "concept_only",
    "no_primary_source",
    "duplicate",
    "duplicate_project",
    "ai_misidentified",
  ]);

  for (const row of rows) {
    const sourceKey = row.sourceKey ?? "unknown";
    const sourceName = row.sourceName ?? "Unknown source";
    const source =
      sourceMap.get(sourceKey) ??
      {
        sourceKey,
        sourceName,
        signalIds: new Set<string>(),
        entityIds: new Set<string>(),
        accept: 0,
        reject: 0,
        merge: 0,
        rejectReasons: new Map<string, number>(),
      };
    if (row.signalId) {
      source.signalIds.add(row.signalId);
    }
    if (row.entityHintId) {
      source.entityIds.add(row.entityHintId);
    }
    if (row.decision === "ACCEPT") {
      source.accept += 1;
    }
    if (row.decision === "REJECT") {
      source.reject += 1;
    }
    if (row.decision === "MERGE") {
      source.merge += 1;
    }
    sourceMap.set(sourceKey, source);

    const entityType = row.entityType ?? "UNKNOWN";
    const type =
      typeMap.get(entityType) ??
      {
        entityType,
        count: 0,
        accepted: 0,
        rejected: 0,
        rejectReasons: new Map<string, number>(),
      };
    type.count += 1;
    if (row.decision === "ACCEPT") {
      type.accepted += 1;
    }
    if (row.decision === "REJECT") {
      type.rejected += 1;
    }
    typeMap.set(entityType, type);

    for (const tag of tagsFromJson(row.reasonTags)) {
      if (row.decision === "REJECT") {
        source.rejectReasons.set(tag, (source.rejectReasons.get(tag) ?? 0) + 1);
        type.rejectReasons.set(tag, (type.rejectReasons.get(tag) ?? 0) + 1);
      }
      if (noiseTags.has(tag)) {
        noiseMap.set(tag, (noiseMap.get(tag) ?? 0) + 1);
      }
    }
  }

  const sourcePerformance = Array.from(sourceMap.values())
    .map((item) => {
      const totalDecisions = item.accept + item.reject + item.merge;
      return {
        sourceKey: item.sourceKey,
        sourceName: item.sourceName,
        signalCount: item.signalIds.size,
        entityCount: item.entityIds.size,
        acceptCount: item.accept,
        rejectCount: item.reject,
        mergeCount: item.merge,
        acceptRate: rate(item.accept, totalDecisions),
        rejectRate: rate(item.reject, totalDecisions),
        topRejectReasons: topTags(item.rejectReasons, 5),
      };
    })
    .sort((a, b) => b.entityCount - a.entityCount || b.rejectRate - a.rejectRate);

  const entityTypePerformance = Array.from(typeMap.values())
    .map((item) => ({
      entityType: item.entityType,
      count: item.count,
      accepted: item.accepted,
      rejected: item.rejected,
      acceptRate: rate(item.accepted, item.count),
      topRejectReasons: topTags(item.rejectReasons, 5),
    }))
    .sort((a, b) => b.count - a.count || b.acceptRate - a.acceptRate);

  const noisePatterns = topTags(noiseMap, 10);
  const suggestions = buildLearningSuggestions(sourcePerformance, entityTypePerformance, noisePatterns);

  return { sourcePerformance, entityTypePerformance, noisePatterns, suggestions };
}

function buildLearningSuggestions(
  sources: LearningAnalyticsRow[],
  types: EntityTypeAnalyticsRow[],
  noise: Array<{ tag: string; count: number }>,
): string[] {
  const suggestions: string[] = [];
  const noisySource = sources.find((source) => source.entityCount >= 5 && source.rejectRate >= 60);
  if (noisySource) {
    suggestions.push(`Lower extraction weight or tighten rules for ${noisySource.sourceKey}.`);
  }
  const strongSource = sources.find((source) => source.entityCount >= 5 && source.acceptRate >= 60);
  if (strongSource) {
    suggestions.push(`Keep tracking ${strongSource.sourceKey}; its accept rate is comparatively strong.`);
  }
  const weakType = types.find((type) => type.count >= 5 && type.acceptRate < 30);
  if (weakType) {
    suggestions.push(`Review prompt/rules for ${weakType.entityType}; accept rate is low.`);
  }
  const topNoise = noise[0];
  if (topNoise) {
    suggestions.push(`Prioritize reducing ${topNoise.tag}; it is the most frequent noise pattern.`);
  }
  if (suggestions.length === 0) {
    suggestions.push("Collect more structured feedback before changing ranking or extraction prompts.");
  }
  return suggestions;
}
