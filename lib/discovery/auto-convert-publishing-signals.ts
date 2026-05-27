import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { attachDiscoveryScopesToMetadata } from "@/lib/discovery/scope-from-config";
import { parseScopesFromConfigJson } from "@/lib/discovery/scope-from-config";
import type { DiscoveryScope } from "@/lib/discovery/discovery-scopes";
import {
  convertDiscoverySignalToCandidateWithOverrides,
  type ConvertSignalOverrides,
} from "@/lib/discovery/signals";

export const AUTO_CONVERT_CONFIDENCE_THRESHOLD = 0.72;

export type SignalMetadata = {
  confidence?: number;
  reasons?: string[];
  filterSignals?: string[];
  discoveryScopes?: string[];
  sourceKey?: string;
  sourceUrl?: string;
  autoConvertEligible?: boolean;
};

function metadataFromSignal(metadataJson: unknown): SignalMetadata {
  if (!metadataJson || typeof metadataJson !== "object" || Array.isArray(metadataJson)) {
    return {};
  }
  return metadataJson as SignalMetadata;
}

function isHighConfidenceForAutoConvert(signal: {
  metadataJson: unknown;
  guessedGithubUrl: string | null;
  guessedWebsiteUrl: string | null;
  guessedProjectName: string | null;
  title: string;
}): boolean {
  const meta = metadataFromSignal(signal.metadataJson);
  const confidence = typeof meta.confidence === "number" ? meta.confidence : 0;

  if (confidence < AUTO_CONVERT_CONFIDENCE_THRESHOLD) {
    return false;
  }

  if (meta.autoConvertEligible === true || signal.guessedGithubUrl?.trim()) {
    return true;
  }

  const toolLike =
    /(tool|platform|app|open-source|open source|launch|assistant|generator)/i.test(signal.title) &&
    Boolean(signal.guessedWebsiteUrl?.trim() || signal.guessedProjectName?.trim());

  if (toolLike) {
    return true;
  }

  // RSS/新闻类：出版+AI 等高置信条目无 GitHub 也可转 Candidate，由 Admin 审核
  return confidence >= 0.85;
}

export async function autoConvertHighConfidencePublishingSignals(options?: {
  sourceId?: string;
  limit?: number;
}): Promise<{ scanned: number; converted: number; skipped: number; errors: string[] }> {
  const limit = Math.min(50, Math.max(1, options?.limit ?? 20));

  const signals = await prisma.discoverySignal.findMany({
    where: {
      status: "PENDING",
      ...(options?.sourceId ? { sourceId: options.sourceId } : {}),
    },
    include: { source: { select: { key: true, configJson: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  let converted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const signal of signals) {
    const scopes = parseScopesFromConfigJson(signal.source.configJson);
    if (!scopes.includes("publishing_ai")) {
      skipped += 1;
      continue;
    }

    if (!isHighConfidenceForAutoConvert(signal)) {
      skipped += 1;
      continue;
    }

    const meta = metadataFromSignal(signal.metadataJson);
    const overrides: ConvertSignalOverrides = {
      title: signal.guessedProjectName ?? signal.title,
      summary: signal.summary,
      website: signal.guessedWebsiteUrl,
      repoUrl: signal.guessedGithubUrl,
    };

    try {
      const { candidateId } = await convertDiscoverySignalToCandidateWithOverrides(signal.id, overrides);

      await prisma.discoveryCandidate.update({
        where: { id: candidateId },
        data: {
          metadataJson: attachDiscoveryScopesToMetadata(
            {
              fromSignal: true,
              signalId: signal.id,
              confidence: meta.confidence ?? null,
              confidenceReasons: meta.reasons ?? [],
              highConfidenceCandidate: true,
              autoConvertedFromSignal: true,
              sourceKey: signal.source.key,
              sourceUrl: signal.url,
            },
            scopes,
          ) as Prisma.InputJsonValue,
        },
      });

      converted += 1;
    } catch (e) {
      errors.push(`${signal.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { scanned: signals.length, converted, skipped, errors };
}

export function markCandidateHighConfidence(
  metadataJson: unknown,
  args: {
    confidence: number;
    reasons: string[];
    sourceKey: string;
    scopes: string[];
  },
): Record<string, unknown> {
  return attachDiscoveryScopesToMetadata(
    {
      ...(metadataJson && typeof metadataJson === "object" && !Array.isArray(metadataJson)
        ? (metadataJson as Record<string, unknown>)
        : {}),
      highConfidenceCandidate: args.confidence >= AUTO_CONVERT_CONFIDENCE_THRESHOLD,
      confidence: args.confidence,
      confidenceReasons: args.reasons,
      sourceKey: args.sourceKey,
    },
    args.scopes as DiscoveryScope[],
  );
}

export function isHighConfidenceCandidate(metadataJson: unknown): boolean {
  if (!metadataJson || typeof metadataJson !== "object" || Array.isArray(metadataJson)) {
    return false;
  }
  const m = metadataJson as Record<string, unknown>;
  return m.highConfidenceCandidate === true;
}
