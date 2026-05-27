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
  force?: boolean;
};

export type ExtractHintsForSignalResult = PersistEntityHintsResult & {
  signalId: string;
  hintDrafts: ExtractedEntityHintDraft[];
  skippedReason?: string;
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
    useAi: options?.useAi ?? true,
  });

  if (extraction.hints.length === 0) {
    return {
      signalId,
      extracted: 0,
      skipped: 1,
      duplicate: 0,
      errors: [],
      hintDrafts: [],
      skippedReason: extraction.skippedReason ?? "no_entities_detected",
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
  signalId?: string;
  force?: boolean;
};

export type BatchExtractEntityHintsResult = {
  scanned: number;
  extracted: number;
  skipped: number;
  duplicate: number;
  errors: string[];
};

export async function batchExtractEntityHints(
  options?: BatchExtractEntityHintsOptions,
): Promise<BatchExtractEntityHintsResult> {
  const limit = Math.min(500, Math.max(1, options?.limit ?? 50));

  if (options?.signalId) {
    const one = await extractAndPersistHintsForSignal(options.signalId, {
      dryRun: options.dryRun,
      useAi: options.useAi,
      force: options.force,
    });
    return {
      scanned: 1,
      extracted: one.extracted,
      skipped: one.skipped,
      duplicate: one.duplicate,
      errors: one.errors,
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
  const errors: string[] = [];

  for (const signal of toProcess) {
    const result = await extractAndPersistHintsForSignal(signal.id, {
      dryRun: options?.dryRun,
      useAi: options?.useAi,
      force: options?.force,
    });
    extracted += result.extracted;
    skipped += result.skipped;
    duplicate += result.duplicate;
    errors.push(...result.errors);
  }

  return {
    scanned: toProcess.length,
    extracted,
    skipped,
    duplicate,
    errors,
  };
}
