import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isEntityHintExtractionEnabled } from "@/lib/discovery/discovery-feature-flags";
import { extractEntityHintsFromSignal } from "@/lib/discovery/entity/extract-from-signal";
import {
  buildEntityHintDedupeKey,
  normalizeEntityName,
} from "@/lib/discovery/entity/normalize-name";
import {
  parseSourceAuthorityTier,
  type ExtractedEntityHintDraft,
  type PersistEntityHintsResult,
} from "@/lib/discovery/entity/types";
import {
  metadataDiscoveryScopes,
  parseScopesFromConfigJson,
} from "@/lib/discovery/scope-from-config";
import { mergeDiscoveryScopes, type DiscoveryScope } from "@/lib/discovery/discovery-scopes";

export type ExtractHintsForSignalOptions = {
  dryRun?: boolean;
  useAi?: boolean;
  useAiJudge?: boolean;
  noAiJudge?: boolean;
  minConfidence?: number;
  minRelevance?: number;
  force?: boolean;
};

export type ExtractHintsForSignalResult = PersistEntityHintsResult & {
  signalId: string;
  hintDrafts: ExtractedEntityHintDraft[];
  skippedReason?: string;
  skippedLowQuality?: number;
  skippedNavigation?: number;
  skippedGeneric?: number;
};

function resolveScopes(
  signalMetadata: unknown,
  sourceConfig: unknown,
  scopeFilter?: DiscoveryScope,
): DiscoveryScope[] {
  const fromMeta = metadataDiscoveryScopes(signalMetadata);
  const fromSource = parseScopesFromConfigJson(sourceConfig);
  const merged = mergeDiscoveryScopes(fromMeta, fromSource);
  if (scopeFilter && !merged.includes(scopeFilter)) {
    return [];
  }
  return merged;
}

export async function extractAndPersistHintsForSignal(
  signalId: string,
  options?: ExtractHintsForSignalOptions,
): Promise<ExtractHintsForSignalResult> {
  if (!options?.force && !isEntityHintExtractionEnabled()) {
    return {
      signalId,
      extracted: 0,
      skipped: 0,
      duplicate: 0,
      errors: ["ENTITY_HINT_EXTRACTION_ENABLED is off"],
      hintDrafts: [],
    };
  }

  const signal = await prisma.discoverySignal.findUnique({
    where: { id: signalId },
    include: {
      source: { select: { configJson: true, name: true, type: true } },
    },
  });

  if (!signal) {
    return {
      signalId,
      extracted: 0,
      skipped: 0,
      duplicate: 0,
      errors: [`Signal not found: ${signalId}`],
      hintDrafts: [],
    };
  }

  const discoveryScopes = resolveScopes(signal.metadataJson, signal.source.configJson);
  const sourceAuthorityTier = parseSourceAuthorityTier(signal.source.configJson);

  const extraction = await extractEntityHintsFromSignal({
    signalId: signal.id,
    title: signal.title,
    summary: signal.summary,
    rawText: signal.rawText,
    url: signal.url,
    signalType: signal.signalType,
    sourceType: signal.sourceType,
    sourceName: signal.sourceName,
    guessedProjectName: signal.guessedProjectName,
    guessedWebsiteUrl: signal.guessedWebsiteUrl,
    guessedGithubUrl: signal.guessedGithubUrl,
    discoveryScopes,
    sourceAuthorityTier,
    metadataJson: signal.metadataJson,
    useAi: options?.useAi ?? true,
    useAiJudge: options?.useAiJudge,
    noAiJudge: options?.noAiJudge,
    minConfidence: options?.minConfidence,
    minRelevance: options?.minRelevance,
  });

  if (extraction.hints.length === 0) {
    const skipStats = extraction.skipStats;
    return {
      signalId,
      extracted: 0,
      skipped: 1,
      duplicate: 0,
      errors: [],
      hintDrafts: [],
      skippedReason: extraction.skippedReason ?? "no_entities_detected",
      skippedLowQuality: skipStats?.skippedLowQuality ?? 0,
      skippedNavigation: skipStats?.skippedNavigation ?? 0,
      skippedGeneric: skipStats?.skippedGeneric ?? 0,
    };
  }

  if (options?.dryRun) {
    return {
      signalId,
      extracted: extraction.hints.length,
      skipped: 0,
      duplicate: 0,
      errors: [],
      hintDrafts: extraction.hints,
    };
  }

  const persist = await persistEntityHintDrafts({
    signalId: signal.id,
    sourceUrl: signal.url,
    sourceTitle: signal.title,
    discoveryScopes,
    drafts: extraction.hints,
  });

  return {
    signalId,
    ...persist,
    hintDrafts: extraction.hints,
    skippedReason: extraction.skippedReason,
    skippedLowQuality: extraction.skipStats?.skippedLowQuality ?? 0,
    skippedNavigation: extraction.skipStats?.skippedNavigation ?? 0,
    skippedGeneric: extraction.skipStats?.skippedGeneric ?? 0,
  };
}

export async function persistEntityHintDrafts(input: {
  signalId: string;
  sourceUrl: string;
  sourceTitle: string;
  discoveryScopes: string[];
  drafts: ExtractedEntityHintDraft[];
}): Promise<PersistEntityHintsResult> {
  let extracted = 0;
  let duplicate = 0;
  const errors: string[] = [];

  for (const draft of input.drafts) {
    const normalizedName = normalizeEntityName(draft.name);
    if (!normalizedName) {
      continue;
    }

    const dedupeKey = buildEntityHintDedupeKey({
      sourceSignalId: input.signalId,
      normalizedName,
      discoveryScopes: input.discoveryScopes,
    });

    try {
      const existing = await prisma.entityHint.findUnique({
        where: { dedupeKey },
        select: { id: true },
      });
      if (existing) {
        duplicate += 1;
        continue;
      }

      await prisma.entityHint.create({
        data: {
          name: draft.name.trim(),
          normalizedName,
          entityType: draft.entityType,
          discoveryScopes: input.discoveryScopes as unknown as Prisma.InputJsonValue,
          sourceSignalId: input.signalId,
          sourceUrl: input.sourceUrl,
          sourceTitle: input.sourceTitle,
          sourceTextSnippet: draft.sourceTextSnippet ?? null,
          evidenceJson: draft.evidenceJson as unknown as Prisma.InputJsonValue,
          confidence: draft.confidence,
          status: "PENDING",
          reason: draft.reason,
          dedupeKey,
        },
      });
      extracted += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Unique constraint") || message.includes("dedupeKey")) {
        duplicate += 1;
      } else {
        errors.push(`${draft.name}: ${message}`);
      }
    }
  }

  return {
    extracted,
    skipped: 0,
    duplicate,
    errors,
  };
}

export type BatchExtractEntityHintsOptions = {
  scope?: DiscoveryScope;
  limit?: number;
  dryRun?: boolean;
  useAi?: boolean;
  useAiJudge?: boolean;
  noAiJudge?: boolean;
  minConfidence?: number;
  minRelevance?: number;
  signalId?: string;
  force?: boolean;
};

export type BatchExtractEntityHintsResult = {
  scanned: number;
  extracted: number;
  skipped: number;
  duplicate: number;
  skippedLowQuality: number;
  skippedNavigation: number;
  skippedGeneric: number;
  skippedReasons: string[];
  errors: string[];
  error: number;
};

export async function extractEntitiesFromSignal(
  signalId: string,
  options?: ExtractHintsForSignalOptions,
): Promise<ExtractHintsForSignalResult> {
  return extractAndPersistHintsForSignal(signalId, options);
}

export async function extractEntitiesFromSourceRun(
  runId: string,
  options?: Omit<BatchExtractEntityHintsOptions, "signalId">,
): Promise<BatchExtractEntityHintsResult> {
  const run = await prisma.discoveryRun.findUnique({
    where: { id: runId },
    select: {
      sourceId: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
    },
  });

  if (!run) {
    return {
      scanned: 0,
      extracted: 0,
      skipped: 0,
      duplicate: 0,
      skippedLowQuality: 0,
      skippedNavigation: 0,
      skippedGeneric: 0,
      skippedReasons: [],
      errors: [`SourceRun not found: ${runId}`],
      error: 1,
    };
  }

  const startedAt = run.startedAt ?? run.createdAt;
  const finishedAt = run.finishedAt ?? new Date();
  const limit = Math.min(500, Math.max(1, options?.limit ?? 100));
  const signals = await prisma.discoverySignal.findMany({
    where: {
      sourceId: run.sourceId,
      createdAt: {
        gte: startedAt,
        lte: finishedAt,
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true },
  });

  return extractSignalsByIds(
    signals.map((signal) => signal.id),
    options,
  );
}

export async function extractEntitiesFromRecentSignals(
  options?: BatchExtractEntityHintsOptions,
): Promise<BatchExtractEntityHintsResult> {
  return batchExtractEntityHints(options);
}

async function extractSignalsByIds(
  signalIds: string[],
  options?: Omit<BatchExtractEntityHintsOptions, "signalId">,
): Promise<BatchExtractEntityHintsResult> {
  let extracted = 0;
  let skipped = 0;
  let duplicate = 0;
  let skippedLowQuality = 0;
  let skippedNavigation = 0;
  let skippedGeneric = 0;
  const skippedReasons: string[] = [];
  const errors: string[] = [];

  for (const signalId of signalIds) {
    const result = await extractAndPersistHintsForSignal(signalId, {
      dryRun: options?.dryRun,
      useAi: options?.useAi,
      useAiJudge: options?.useAiJudge,
      noAiJudge: options?.noAiJudge,
      minConfidence: options?.minConfidence,
      minRelevance: options?.minRelevance,
      force: options?.force,
    });
    extracted += result.extracted;
    skipped += result.skipped;
    duplicate += result.duplicate;
    skippedLowQuality += result.skippedLowQuality ?? 0;
    skippedNavigation += result.skippedNavigation ?? 0;
    skippedGeneric += result.skippedGeneric ?? 0;
    if (result.skippedReason) {
      skippedReasons.push(result.skippedReason);
    }
    errors.push(...result.errors);
  }

  return {
    scanned: signalIds.length,
    extracted,
    skipped,
    duplicate,
    skippedLowQuality,
    skippedNavigation,
    skippedGeneric,
    skippedReasons: [...new Set(skippedReasons)].slice(0, 20),
    errors,
    error: errors.length,
  };
}

export async function batchExtractEntityHints(
  options?: BatchExtractEntityHintsOptions,
): Promise<BatchExtractEntityHintsResult> {
  const limit = Math.min(500, Math.max(1, options?.limit ?? 50));

  if (options?.signalId) {
    const one = await extractAndPersistHintsForSignal(options.signalId, {
      dryRun: options.dryRun,
      useAi: options.useAi,
      useAiJudge: options.useAiJudge,
      noAiJudge: options.noAiJudge,
      minConfidence: options.minConfidence,
      minRelevance: options.minRelevance,
      force: options.force,
    });
    return {
      scanned: 1,
      extracted: one.extracted,
      skipped: one.skipped,
      duplicate: one.duplicate,
      skippedLowQuality: one.skippedLowQuality ?? 0,
      skippedNavigation: one.skippedNavigation ?? 0,
      skippedGeneric: one.skippedGeneric ?? 0,
      skippedReasons: one.skippedReason ? [one.skippedReason] : [],
      errors: one.errors,
      error: one.errors.length,
    };
  }

  const signals = await prisma.discoverySignal.findMany({
    orderBy: { createdAt: "desc" },
    take: limit * 3,
    include: {
      source: { select: { configJson: true } },
    },
  });

  const scopeFilter = options?.scope;
  const filtered = signals.filter((signal) => {
    const scopes = resolveScopes(signal.metadataJson, signal.source.configJson, scopeFilter);
    if (scopeFilter && scopes.length === 0) {
      return false;
    }
    return true;
  });

  const toProcess = filtered.slice(0, limit);

  let extracted = 0;
  let skipped = 0;
  let duplicate = 0;
  let skippedLowQuality = 0;
  let skippedNavigation = 0;
  let skippedGeneric = 0;
  const skippedReasons: string[] = [];
  const errors: string[] = [];

  for (const signal of toProcess) {
    const result = await extractAndPersistHintsForSignal(signal.id, {
      dryRun: options?.dryRun,
      useAi: options?.useAi,
      useAiJudge: options?.useAiJudge,
      noAiJudge: options?.noAiJudge,
      minConfidence: options?.minConfidence,
      minRelevance: options?.minRelevance,
      force: options?.force,
    });
    extracted += result.extracted;
    skipped += result.skipped;
    duplicate += result.duplicate;
    skippedLowQuality += result.skippedLowQuality ?? 0;
    skippedNavigation += result.skippedNavigation ?? 0;
    skippedGeneric += result.skippedGeneric ?? 0;
    if (result.skippedReason) {
      skippedReasons.push(result.skippedReason);
    }
    errors.push(...result.errors);
  }

  return {
    scanned: toProcess.length,
    extracted,
    skipped,
    duplicate,
    skippedLowQuality,
    skippedNavigation,
    skippedGeneric,
    skippedReasons: [...new Set(skippedReasons)].slice(0, 20),
    errors,
    error: errors.length,
  };
}
