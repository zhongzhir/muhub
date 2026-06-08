import { Prisma, type DiscoverySource } from "@prisma/client";
import { isVerticalDiscoveryRssEnabled } from "@/lib/discovery/discovery-feature-flags";
import { extractEntitiesFromSignal } from "@/lib/discovery/entity/persist-hints";
import { fetchRssFeedItems } from "@/lib/discovery/rss/fetch-rss-feed";
import { filterPublishingRelevantContent } from "@/lib/discovery/rss/publishing-content-filter";
import { parseScopesFromConfigJson } from "@/lib/discovery/scope-from-config";
import { upsertDiscoverySignalFromSeed } from "@/lib/discovery/signals";
import { prisma } from "@/lib/prisma";

export type RunRssDiscoveryForSourceResult = {
  fetchedCount: number;
  parsedCount: number;
  newCandidateCount: number;
  updatedCandidateCount: number;
  filteredCount: number;
  autoConvertedCandidates: number;
  entityExtractionSignals: number;
  entityExtracted: number;
  entityDuplicate: number;
  entitySkipped: number;
  entityFailed: number;
  entityAlreadyExtracted: number;
  error?: string;
};

type RssSourceConfig = {
  mode?: string;
  url?: string;
  maxItems?: number;
  requireAiHint?: boolean;
  filterMode?: "relaxed" | "strict";
  extractProjectHints?: boolean;
  entityExtraction?: {
    enabled?: boolean;
    mode?: "auto" | "manual";
    maxSignalsPerRun?: number;
    useAi?: boolean;
    minTextLength?: number;
    scopes?: string[];
  };
};

export type RssEntityExtractionConfig = {
  enabled: boolean;
  disabledReason: string | null;
  maxSignalsPerRun: number;
  useAi: boolean;
  minTextLength: number;
};

type RssSignalForEntityExtraction = {
  signalId: string;
  title: string;
  summary: string | null;
  rawText: string | null;
};

type RssEntityExtractionStats = {
  entityExtractionSignals: number;
  entityExtracted: number;
  entityDuplicate: number;
  entitySkipped: number;
  entityFailed: number;
  entityAlreadyExtracted: number;
};

const EMPTY_ENTITY_EXTRACTION_STATS: RssEntityExtractionStats = {
  entityExtractionSignals: 0,
  entityExtracted: 0,
  entityDuplicate: 0,
  entitySkipped: 0,
  entityFailed: 0,
  entityAlreadyExtracted: 0,
};

function emptyResult(error?: string): RunRssDiscoveryForSourceResult {
  return {
    fetchedCount: 0,
    parsedCount: 0,
    newCandidateCount: 0,
    updatedCandidateCount: 0,
    filteredCount: 0,
    autoConvertedCandidates: 0,
    ...EMPTY_ENTITY_EXTRACTION_STATS,
    error,
  };
}

function configObject(configJson: unknown): Record<string, unknown> {
  return configJson && typeof configJson === "object" && !Array.isArray(configJson)
    ? (configJson as Record<string, unknown>)
    : {};
}

function entityExtractionObject(configJson: unknown): Record<string, unknown> {
  const raw = configObject(configJson).entityExtraction;
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

function positiveInt(value: unknown, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(1, Math.floor(value)));
}

function configuredScopes(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

export function parseRssEntityExtractionConfig(input: {
  scopes: string[];
  configJson: unknown;
}): RssEntityExtractionConfig {
  const cfg = entityExtractionObject(input.configJson);
  const enabledRaw = cfg.enabled;
  const scopeAllowList = configuredScopes(cfg.scopes);
  const scopeAllowed =
    scopeAllowList.length > 0
      ? input.scopes.some((scope) => scopeAllowList.includes(scope))
      : input.scopes.includes("publishing_ai");

  if (enabledRaw === false) {
    return {
      enabled: false,
      disabledReason: "entityExtraction disabled",
      maxSignalsPerRun: positiveInt(cfg.maxSignalsPerRun, 5, 50),
      useAi: cfg.useAi === false ? false : true,
      minTextLength: positiveInt(cfg.minTextLength, 200, 10_000),
    };
  }

  const enabled = enabledRaw === true || scopeAllowed;
  return {
    enabled,
    disabledReason: enabled ? null : "source scope not allowed",
    maxSignalsPerRun: positiveInt(cfg.maxSignalsPerRun, 5, 50),
    useAi: cfg.useAi === false ? false : true,
    minTextLength: positiveInt(cfg.minTextLength, 200, 10_000),
  };
}

function combinedSignalTextLength(signal: RssSignalForEntityExtraction): number {
  return [signal.title, signal.summary, signal.rawText]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n").length;
}

function metadataWithEntityExtraction(
  metadataJson: unknown,
  entityExtraction: Record<string, unknown>,
): Prisma.InputJsonValue {
  return {
    ...configObject(metadataJson),
    entityExtraction,
  } as Prisma.InputJsonValue;
}

async function updateSignalEntityExtractionMetadata(
  signalId: string,
  entityExtraction: Record<string, unknown>,
): Promise<void> {
  const current = await prisma.discoverySignal.findUnique({
    where: { id: signalId },
    select: { metadataJson: true },
  });
  await prisma.discoverySignal.update({
    where: { id: signalId },
    data: {
      metadataJson: metadataWithEntityExtraction(current?.metadataJson, entityExtraction),
    },
  });
}

async function runRssEntityExtractionForSignals(args: {
  sourceKey: string;
  runId?: string;
  signals: RssSignalForEntityExtraction[];
  config: RssEntityExtractionConfig;
  logs: string[];
}): Promise<RssEntityExtractionStats> {
  const { sourceKey, runId, logs, config } = args;
  const stats: RssEntityExtractionStats = { ...EMPTY_ENTITY_EXTRACTION_STATS };

  if (!config.enabled) {
    for (const signal of args.signals) {
      await updateSignalEntityExtractionMetadata(signal.signalId, {
        status: "disabled",
        reason: config.disabledReason,
        sourceRunId: runId ?? null,
        updatedAt: new Date().toISOString(),
      });
    }
    logs.push(`[${sourceKey}] entity_extraction skipped reason=${config.disabledReason}`);
    return stats;
  }

  const toProcess = args.signals.slice(0, config.maxSignalsPerRun);
  stats.entityExtractionSignals = toProcess.length;

  for (const signal of toProcess) {
    const textLength = combinedSignalTextLength(signal);
    if (textLength < config.minTextLength) {
      stats.entitySkipped += 1;
      await updateSignalEntityExtractionMetadata(signal.signalId, {
        status: "skipped",
        reason: "text too short",
        textLength,
        minTextLength: config.minTextLength,
        sourceRunId: runId ?? null,
        updatedAt: new Date().toISOString(),
      });
      logs.push(
        `[${sourceKey}] entity_extraction skipped signal=${signal.signalId} reason=text too short textLength=${textLength}`,
      );
      continue;
    }

    const existing = await prisma.entityHint.count({
      where: { sourceSignalId: signal.signalId },
    });
    if (existing > 0) {
      stats.entityDuplicate += existing;
      stats.entityAlreadyExtracted += 1;
      await updateSignalEntityExtractionMetadata(signal.signalId, {
        status: "already_extracted",
        reason: "already extracted",
        entityCount: existing,
        textLength,
        sourceRunId: runId ?? null,
        updatedAt: new Date().toISOString(),
      });
      continue;
    }

    try {
      const result = await extractEntitiesFromSignal(signal.signalId, {
        useAi: config.useAi,
        force: false,
        sourceRunId: runId,
        reason: "rss_auto_entity_extraction",
      });
      if (result.errors.length > 0) {
        stats.entityFailed += 1;
        logs.push(
          `[${sourceKey}] entity_extraction failed signal=${signal.signalId} errors=${result.errors.join("; ")}`,
        );
      }
      stats.entityExtracted += result.extracted;
      stats.entityDuplicate += result.duplicate;
      stats.entitySkipped += result.skipped;
      await updateSignalEntityExtractionMetadata(signal.signalId, {
        status:
          result.errors.length > 0
            ? "failed"
            : result.extracted > 0
              ? "extracted"
              : "skipped",
        reason:
          result.errors.length > 0
            ? "extraction failed"
            : result.skippedReason ?? (result.extracted > 0 ? null : "no_entities_detected"),
        extracted: result.extracted,
        duplicate: result.duplicate,
        skipped: result.skipped,
        errors: result.errors,
        textSource: result.textSource ?? null,
        textLength: result.textLength ?? textLength,
        sourceRunId: runId ?? null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      stats.entityFailed += 1;
      const message = error instanceof Error ? error.message : String(error);
      await updateSignalEntityExtractionMetadata(signal.signalId, {
        status: "failed",
        reason: "extraction failed",
        error: message,
        textLength,
        sourceRunId: runId ?? null,
        updatedAt: new Date().toISOString(),
      });
      logs.push(`[${sourceKey}] entity_extraction failed signal=${signal.signalId} error=${message}`);
    }
  }

  const remaining = args.signals.slice(config.maxSignalsPerRun);
  for (const signal of remaining) {
    stats.entitySkipped += 1;
    await updateSignalEntityExtractionMetadata(signal.signalId, {
      status: "skipped",
      reason: "maxSignalsPerRun reached",
      maxSignalsPerRun: config.maxSignalsPerRun,
      sourceRunId: runId ?? null,
      updatedAt: new Date().toISOString(),
    });
  }

  logs.push(
    `[${sourceKey}] entity_extraction done entityExtractionSignals=${stats.entityExtractionSignals} entityExtracted=${stats.entityExtracted} entityDuplicate=${stats.entityDuplicate} entitySkipped=${stats.entitySkipped} entityFailed=${stats.entityFailed} entityAlreadyExtracted=${stats.entityAlreadyExtracted}`,
  );
  return stats;
}

export async function runRssDiscoveryForSource(args: {
  source: Pick<DiscoverySource, "id" | "key" | "name" | "type" | "configJson">;
  logs: string[];
  runId?: string;
}): Promise<RunRssDiscoveryForSourceResult> {
  const { source, logs } = args;
  const key = source.key;

  if (!isVerticalDiscoveryRssEnabled()) {
    logs.push(`[${key}] RSS discovery disabled by VERTICAL_DISCOVERY_RSS_ENABLED`);
    return emptyResult("RSS discovery disabled");
  }

  const config = (source.configJson ?? {}) as RssSourceConfig;
  const feedUrl = typeof config.url === "string" ? config.url.trim() : "";
  if (!feedUrl) {
    logs.push(`[${key}] RSS url missing in configJson`);
    return emptyResult("RSS url missing");
  }

  const scopes = parseScopesFromConfigJson(source.configJson);
  const isPublishingScope = scopes.includes("publishing_ai");
  const filterMode = config.filterMode ?? (config.requireAiHint === true ? "strict" : "relaxed");

  const feed = await fetchRssFeedItems({
    url: feedUrl,
    maxItems: typeof config.maxItems === "number" ? config.maxItems : 15,
  });

  if (!feed.ok) {
    logs.push(`[${key}] RSS fetch failed: ${feed.error}`);
    return emptyResult(feed.error);
  }

  let parsedCount = 0;
  let newCandidateCount = 0;
  let updatedCandidateCount = 0;
  let filteredCount = 0;
  const entityExtractionConfig = parseRssEntityExtractionConfig({
    scopes,
    configJson: source.configJson,
  });
  const signalsForEntityExtraction: RssSignalForEntityExtraction[] = [];

  for (const item of feed.items) {
    let confidence = 0.5;
    let reasons: string[] = [];
    let filterSignals: string[] = [];

    if (isPublishingScope) {
      const filter = filterPublishingRelevantContent({
        title: item.title,
        summary: item.summary,
        rawText: item.rawText,
        filterMode,
      });
      confidence = filter.confidence;
      reasons = filter.reasons;
      filterSignals = filter.filterSignals;
      if (!filter.pass) {
        filteredCount += 1;
        continue;
      }
    }

    const up = await upsertDiscoverySignalFromSeed({
      sourceId: source.id,
      sourceType: source.type,
      sourceName: source.name,
      sourceKey: key,
      seed: {
        signalType: source.type,
        title: item.title,
        summary: item.summary ?? undefined,
        url: item.url,
        rawText: item.rawText ?? undefined,
        referenceSources: [
          {
            type: source.type,
            url: item.url,
            title: item.title,
            summary: item.summary ?? undefined,
            sourceName: source.name,
          },
        ],
      },
      metadataJson: {
        confidence,
        reasons,
        filterSignals,
        discoveryScopes: scopes,
        sourceKey: key,
        sourceUrl: feedUrl,
        autoConvertEligible: confidence >= 0.72,
      },
    });

    if (!up) {
      logs.push(`[${key}] skip invalid RSS item: ${item.title.slice(0, 60)}`);
      continue;
    }

    parsedCount += 1;
    signalsForEntityExtraction.push({
      signalId: up.id,
      title: item.title,
      summary: item.summary ?? null,
      rawText: item.rawText ?? null,
    });
    if (up.created) {
      newCandidateCount += 1;
    } else {
      updatedCandidateCount += 1;
    }
  }

  const entityStats = await runRssEntityExtractionForSignals({
    sourceKey: key,
    runId: args.runId,
    signals: signalsForEntityExtraction,
    config: entityExtractionConfig,
    logs,
  });
  const auto = { converted: 0 };

  if (auto.converted > 0) {
    logs.push(`[${key}] auto-converted signals→candidates=${auto.converted}`);
  }

  logs.push(
    `[${key}] RSS done fetched=${feed.items.length} parsed=${parsedCount} filtered=${filteredCount}`,
  );

  return {
    fetchedCount: feed.items.length,
    parsedCount,
    newCandidateCount,
    updatedCandidateCount,
    filteredCount,
    autoConvertedCandidates: auto.converted,
    ...entityStats,
    error: undefined,
  };
}
