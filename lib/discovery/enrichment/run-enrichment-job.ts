import { prisma } from "@/lib/prisma";
import type { EnrichmentPlatform } from "@/lib/discovery/enrichment/classify-platform";
import { enrichFromGithubOwner } from "@/lib/discovery/enrichment/github-owner";
import { enrichFromGithubReadme } from "@/lib/discovery/enrichment/github-readme";
import { enrichFromGithubRepoHomepage } from "@/lib/discovery/enrichment/github-repo-homepage";
import {
  hostFromNormalizedUrl,
  normalizeEnrichmentUrl,
} from "@/lib/discovery/enrichment/url-utils";
import { enrichFromWebsiteHomepage } from "@/lib/discovery/enrichment/website-html";
import type { Prisma } from "@prisma/client";
import { persistReviewPriorityForCandidateId } from "@/lib/discovery/persist-review-priority";

export type EnrichmentRunResult = {
  jobId: string;
  ok: boolean;
  extractedCount: number;
  logs: string[];
  error?: string;
};

type MergeItem = {
  url: string;
  platform: EnrichmentPlatform;
  source: string;
  confidence: number;
  evidenceText?: string;
  normalizedUrl: string;
  host: string | null;
};

export async function runDiscoveryEnrichment(candidateId: string): Promise<EnrichmentRunResult> {
  const logs: string[] = [];
  const candidate = await prisma.discoveryCandidate.findUnique({
    where: { id: candidateId },
  });
  if (!candidate) {
    return { jobId: "", ok: false, extractedCount: 0, logs, error: "候选不存在" };
  }

  const job = await prisma.discoveryEnrichmentJob.create({
    data: {
      candidateId,
      source: "enrichment-v1",
      status: "RUNNING",
      logJson: [],
    },
  });
  logs.push(`[job] ${job.id} started`);

  try {
    const merged = new Map<string, MergeItem>();

    const consider = (items: MergeItem[]) => {
      for (const it of items) {
        const prev = merged.get(it.normalizedUrl);
        if (!prev || it.confidence > prev.confidence) {
          merged.set(it.normalizedUrl, it);
        }
      }
    };

    if (candidate.repoUrl?.trim()) {
      const hp = await enrichFromGithubRepoHomepage(candidate.repoUrl, logs);
      consider(
        hp
          .map((x) => {
            const n = normalizeEnrichmentUrl(x.url);
            if (!n) {
              return null;
            }
            return {
              ...x,
              normalizedUrl: n,
              host: hostFromNormalizedUrl(n),
            };
          })
          .filter((x): x is MergeItem => x !== null),
      );

      const rm = await enrichFromGithubReadme(candidate.repoUrl, logs);
      consider(
        rm
          .map((x) => {
            const n = normalizeEnrichmentUrl(x.url);
            if (!n) {
              return null;
            }
            return {
              ...x,
              normalizedUrl: n,
              host: hostFromNormalizedUrl(n),
            };
          })
          .filter((x): x is MergeItem => x !== null),
      );
    }

    const own = await enrichFromGithubOwner(candidate.ownerName, logs);
    consider(
      own
        .map((x) => {
          const n = normalizeEnrichmentUrl(x.url);
          if (!n) {
            return null;
          }
          return { ...x, normalizedUrl: n, host: hostFromNormalizedUrl(n) };
        })
        .filter((x): x is MergeItem => x !== null),
    );

    if (candidate.website?.trim()) {
      const w = await enrichFromWebsiteHomepage(candidate.website, logs);
      consider(
        w
          .map((x) => {
            const n = normalizeEnrichmentUrl(x.url);
            if (!n) {
              return null;
            }
            return { ...x, normalizedUrl: n, host: hostFromNormalizedUrl(n) };
          })
          .filter((x): x is MergeItem => x !== null),
      );
    }

    let upserted = 0;
    for (const it of merged.values()) {
      const existing = await prisma.discoveryEnrichmentLink.findUnique({
        where: {
          candidateId_normalizedUrl: {
            candidateId,
            normalizedUrl: it.normalizedUrl,
          },
        },
      });
      if (existing?.isAccepted) {
        logs.push(`[skip accepted] ${it.normalizedUrl}`);
        continue;
      }
      await prisma.discoveryEnrichmentLink.upsert({
        where: {
          candidateId_normalizedUrl: {
            candidateId,
            normalizedUrl: it.normalizedUrl,
          },
        },
        create: {
          candidateId,
          jobId: job.id,
          platform: it.platform,
          url: it.url,
          normalizedUrl: it.normalizedUrl,
          host: it.host,
          source: it.source,
          confidence: it.confidence,
          evidenceText: it.evidenceText ?? null,
        },
        update: {
          jobId: job.id,
          platform: it.platform,
          url: it.url,
          host: it.host,
          source: it.source,
          confidence: it.confidence,
          evidenceText: it.evidenceText ?? null,
        },
      });
      upserted += 1;
    }

    await prisma.discoveryEnrichmentJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        extractedCount: merged.size,
        logJson: logs as unknown as Prisma.InputJsonValue,
      },
    });
    await prisma.discoveryCandidate.update({
      where: { id: candidateId },
      data: { enrichmentStatus: "OK" },
    });
    await persistReviewPriorityForCandidateId(prisma, candidateId);
    logs.push(`[job] done merged=${merged.size} upserted=${upserted}`);
    return { jobId: job.id, ok: true, extractedCount: merged.size, logs };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logs.push(`[job] FATAL ${msg}`);
    await prisma.discoveryEnrichmentJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: msg,
        logJson: logs as unknown as Prisma.InputJsonValue,
      },
    });
    await prisma.discoveryCandidate.update({
      where: { id: candidateId },
      data: { enrichmentStatus: "FAILED" },
    });
    await persistReviewPriorityForCandidateId(prisma, candidateId);
    return {
      jobId: job.id,
      ok: false,
      extractedCount: 0,
      logs,
      error: msg,
    };
  }
}
