import type { DiscoverySource } from "@prisma/client";
import { autoConvertHighConfidencePublishingSignals } from "@/lib/discovery/auto-convert-publishing-signals";
import { isVerticalDiscoveryRssEnabled } from "@/lib/discovery/discovery-feature-flags";
import { fetchRssFeedItems } from "@/lib/discovery/rss/fetch-rss-feed";
import { filterPublishingRelevantContent } from "@/lib/discovery/rss/publishing-content-filter";
import { parseScopesFromConfigJson } from "@/lib/discovery/scope-from-config";
import { upsertDiscoverySignalFromSeed } from "@/lib/discovery/signals";

export type RunRssDiscoveryForSourceResult = {
  fetchedCount: number;
  parsedCount: number;
  newCandidateCount: number;
  updatedCandidateCount: number;
  filteredCount: number;
  autoConvertedCandidates: number;
  error?: string;
};

type RssSourceConfig = {
  mode?: string;
  url?: string;
  maxItems?: number;
  requireAiHint?: boolean;
  filterMode?: "relaxed" | "strict";
  extractProjectHints?: boolean;
};

export async function runRssDiscoveryForSource(args: {
  source: Pick<DiscoverySource, "id" | "key" | "name" | "type" | "configJson">;
  logs: string[];
}): Promise<RunRssDiscoveryForSourceResult> {
  const { source, logs } = args;
  const key = source.key;

  if (!isVerticalDiscoveryRssEnabled()) {
    logs.push(`[${key}] RSS discovery disabled by VERTICAL_DISCOVERY_RSS_ENABLED`);
    return {
      fetchedCount: 0,
      parsedCount: 0,
      newCandidateCount: 0,
      updatedCandidateCount: 0,
      filteredCount: 0,
      autoConvertedCandidates: 0,
      error: "RSS discovery disabled",
    };
  }

  const config = (source.configJson ?? {}) as RssSourceConfig;
  const feedUrl = typeof config.url === "string" ? config.url.trim() : "";
  if (!feedUrl) {
    logs.push(`[${key}] RSS url missing in configJson`);
    return {
      fetchedCount: 0,
      parsedCount: 0,
      newCandidateCount: 0,
      updatedCandidateCount: 0,
      filteredCount: 0,
      autoConvertedCandidates: 0,
      error: "RSS url missing",
    };
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
    return {
      fetchedCount: 0,
      parsedCount: 0,
      newCandidateCount: 0,
      updatedCandidateCount: 0,
      filteredCount: 0,
      autoConvertedCandidates: 0,
      error: feed.error,
    };
  }

  let parsedCount = 0;
  let newCandidateCount = 0;
  let updatedCandidateCount = 0;
  let filteredCount = 0;

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
    if (up.created) {
      newCandidateCount += 1;
    } else {
      updatedCandidateCount += 1;
    }
  }

  const auto = await autoConvertHighConfidencePublishingSignals({
    sourceId: source.id,
    limit: 30,
  });

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
    error: undefined,
  };
}
