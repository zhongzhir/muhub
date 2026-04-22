import {
  Prisma,
  type DiscoverySignalStatus,
  type DiscoverySourceType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildGithubNormalizedKey } from "@/lib/discovery/normalize-url";
import { discoveryDedupeHashFromNormalizedKey } from "@/lib/discovery/dedupe-hash";
import {
  normalizeReferenceSources,
  type ReferenceSourceItem,
} from "@/lib/discovery/reference-sources";
import { normalizePrimaryCategoryToSlug } from "@/lib/projects/project-categories";

type SignalSeedInput = {
  signalType?: string;
  title?: string;
  summary?: string;
  url?: string;
  rawText?: string;
  referenceSources?: unknown;
};

const MEDIA_DOMAIN_HINTS = [
  "36kr.com",
  "huxiu.com",
  "ifanr.com",
  "mashable.com",
  "techcrunch.com",
  "theverge.com",
  "wired.com",
  "news.ycombinator.com",
  "zhihu.com",
  "weibo.com",
  "x.com",
  "twitter.com",
  "medium.com",
  "substack.com",
];

function normalizeUrl(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) {
    return null;
  }
  try {
    return new URL(value).href;
  } catch {
    return null;
  }
}

function extractGithubUrl(raw: string): string | null {
  const m = raw.match(/https?:\/\/github\.com\/[^\s)"'<>]+/i);
  if (!m?.[0]) {
    return null;
  }
  return normalizeUrl(m[0]);
}

function extractUrls(raw: string): string[] {
  if (!raw.trim()) {
    return [];
  }
  const matches = raw.match(/https?:\/\/[^\s)"'<>]+/gi) ?? [];
  const out: string[] = [];
  for (const m of matches) {
    const normalized = normalizeUrl(m);
    if (normalized) {
      out.push(normalized);
    }
  }
  return out;
}

function isMediaDomain(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return MEDIA_DOMAIN_HINTS.some((hint) => host.includes(hint));
}

function scoreWebsiteUrl(url: string): number {
  try {
    const u = new URL(url);
    let score = 0;
    if (!isMediaDomain(u.hostname)) {
      score += 3;
    }
    if (!u.pathname || u.pathname === "/") {
      score += 2;
    } else if (u.pathname.split("/").filter(Boolean).length <= 1) {
      score += 1;
    }
    if (u.hostname.includes("github.com")) {
      score -= 5;
    }
    return score;
  } catch {
    return -10;
  }
}

function pickBestWebsiteUrl(candidates: string[]): string | null {
  if (candidates.length === 0) {
    return null;
  }
  const uniq = Array.from(new Set(candidates));
  uniq.sort((a, b) => scoreWebsiteUrl(b) - scoreWebsiteUrl(a));
  return uniq[0] ?? null;
}

function pickGithubUrlFromCandidates(candidates: string[]): string | null {
  for (const url of candidates) {
    if (/^https?:\/\/github\.com\/[^/]+\/[^/]+/i.test(url)) {
      return url;
    }
  }
  return null;
}

function extractQuotedProjectName(title: string): string | null {
  const patterns = [
    /["“”'‘’《》「」『』]([^"“”'‘’《》「」『』]{2,40})["“”'‘’《》「」『』]/,
    /《([^》]{2,40})》/,
  ];
  for (const pattern of patterns) {
    const m = title.match(pattern);
    if (m?.[1]) {
      return m[1].trim();
    }
  }
  return null;
}

function extractTitleCaseProjectName(title: string): string | null {
  const m = title.match(/\b([A-Z][a-zA-Z0-9+\-.]*(?:\s+[A-Z][a-zA-Z0-9+\-.]*){0,4})\b/);
  if (!m?.[1]) {
    return null;
  }
  const value = m[1].trim();
  if (value.length < 2) {
    return null;
  }
  return value;
}

function guessProjectName(title: string): string | null {
  const clean = title.trim().replace(/\s+/g, " ");
  if (!clean) {
    return null;
  }
  const quoted = extractQuotedProjectName(clean);
  if (quoted) {
    return quoted;
  }
  const patterns = [
    /^(.{2,40}?)(发布|上线|完成融资|获投|开源)/,
    /^(.{2,40}?)(announces|launches|raises|open-sources)/i,
  ];
  for (const p of patterns) {
    const m = clean.match(p);
    if (m?.[1]) {
      return m[1].trim();
    }
  }
  const titleCase = extractTitleCaseProjectName(clean);
  if (titleCase) {
    return titleCase;
  }
  const byColon = clean.split(/[：:|-]/).map((part) => part.trim()).filter(Boolean);
  if (byColon.length > 0) {
    return byColon[0]!.slice(0, 40);
  }
  return clean.slice(0, 40);
}

function mergeSignalReferences(
  sourceName: string,
  signalUrl: string,
  referenceSourcesRaw: unknown,
): ReferenceSourceItem[] {
  const refs = normalizeReferenceSources(referenceSourcesRaw);
  const hasSignalUrl = refs.some((r) => r.url === signalUrl);
  if (hasSignalUrl) {
    return refs;
  }
  return [
    {
      type: "NEWS",
      url: signalUrl,
      title: "线索来源",
      source: sourceName,
    },
    ...refs,
  ];
}

export async function upsertDiscoverySignalFromSeed(args: {
  sourceId: string;
  sourceType: DiscoverySourceType;
  sourceName: string;
  seed: SignalSeedInput;
}): Promise<{ created: boolean; id: string } | null> {
  const title = (args.seed.title ?? "").trim();
  const summary = (args.seed.summary ?? "").trim() || null;
  const rawText = (args.seed.rawText ?? "").trim() || null;
  const signalUrl = normalizeUrl(args.seed.url);
  if (!title || !signalUrl) {
    return null;
  }

  const mergedRefs = mergeSignalReferences(args.sourceName, signalUrl, args.seed.referenceSources);
  const refUrls = mergedRefs.map((item) => item.url);
  const rawUrls = extractUrls(rawText ?? "");
  const summaryUrls = extractUrls(summary ?? "");
  const allUrls = [signalUrl, ...refUrls, ...rawUrls, ...summaryUrls];
  const guessedGithubUrl =
    pickGithubUrlFromCandidates(allUrls) ??
    extractGithubUrl(rawText ?? "") ??
    extractGithubUrl(summary ?? "") ??
    extractGithubUrl(signalUrl);
  const guessedWebsiteUrl =
    pickBestWebsiteUrl(allUrls.filter((url) => !url.includes("github.com"))) ?? normalizeUrl(signalUrl);

  const upserted = await prisma.discoverySignal.upsert({
    where: { url: signalUrl },
    update: {
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      sourceName: args.sourceName,
      signalType: (args.seed.signalType ?? args.sourceType).toUpperCase(),
      title,
      summary,
      rawText,
      referenceSources: mergedRefs as unknown as Prisma.InputJsonValue,
      guessedProjectName: guessProjectName(title),
      guessedWebsiteUrl,
      guessedGithubUrl,
    },
    create: {
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      sourceName: args.sourceName,
      signalType: (args.seed.signalType ?? args.sourceType).toUpperCase(),
      title,
      summary,
      url: signalUrl,
      rawText,
      referenceSources: mergedRefs as unknown as Prisma.InputJsonValue,
      guessedProjectName: guessProjectName(title),
      guessedWebsiteUrl,
      guessedGithubUrl,
      status: "PENDING",
    },
    select: { id: true, createdAt: true, updatedAt: true },
  });

  const created = upserted.createdAt.getTime() === upserted.updatedAt.getTime();
  return { created, id: upserted.id };
}

export async function updateDiscoverySignalStatus(
  id: string,
  status: DiscoverySignalStatus,
  reviewNote?: string | null,
): Promise<void> {
  await prisma.discoverySignal.update({
    where: { id },
    data: {
      status,
      reviewNote: reviewNote?.trim() || null,
    },
  });
}

export async function convertDiscoverySignalToCandidate(id: string): Promise<{ candidateId: string }> {
  return convertDiscoverySignalToCandidateWithOverrides(id, {});
}

export type ConvertSignalOverrides = {
  title?: string | null;
  summary?: string | null;
  suggestedCategory?: string | null;
  simpleSummaryCandidate?: string | null;
  website?: string | null;
  repoUrl?: string | null;
  aiInsightRaw?: unknown;
};

export async function convertDiscoverySignalToCandidateWithOverrides(
  id: string,
  overrides: ConvertSignalOverrides,
): Promise<{ candidateId: string }> {
  const signal = await prisma.discoverySignal.findUnique({
    where: { id },
    include: { source: { select: { key: true } } },
  });
  if (!signal) {
    throw new Error("线索不存在");
  }
  if (signal.status === "CONVERTED" && signal.convertedCandidateId) {
    return { candidateId: signal.convertedCandidateId };
  }

  const existing = await prisma.discoveryCandidate.findFirst({
    where: { externalUrl: signal.url },
    select: { id: true },
  });
  if (existing) {
    await prisma.discoverySignal.update({
      where: { id: signal.id },
      data: { status: "CONVERTED", convertedCandidateId: existing.id },
    });
    return { candidateId: existing.id };
  }

  const githubNorm =
    signal.guessedGithubUrl?.trim() && signal.guessedGithubUrl.includes("github.com/")
      ? signal.guessedGithubUrl.trim()
      : null;
  const normalizedKey = githubNorm
    ? (() => {
        const m = githubNorm.match(/github\.com\/([^/]+)\/([^/]+)/i);
        if (!m?.[1] || !m?.[2]) return null;
        return buildGithubNormalizedKey(m[1], m[2].replace(/\.git$/i, ""));
      })()
    : null;
  const dedupeHash = normalizedKey ? discoveryDedupeHashFromNormalizedKey(normalizedKey) : null;
  const titleFinal =
    overrides.title?.trim() ||
    signal.guessedProjectName?.trim() ||
    signal.title;
  const summaryFinal = overrides.summary?.trim() || signal.summary?.trim() || null;
  const suggestedCategorySlug = normalizePrimaryCategoryToSlug(overrides.suggestedCategory);
  const websiteFinal = overrides.website?.trim() || signal.guessedWebsiteUrl?.trim() || null;
  const repoUrlFinal = overrides.repoUrl?.trim() || signal.guessedGithubUrl?.trim() || null;

  const candidate = await prisma.discoveryCandidate.create({
    data: {
      sourceId: signal.sourceId,
      externalType: `signal_${signal.signalType.toLowerCase()}`,
      externalUrl: signal.url,
      sourceKey: signal.source.key,
      normalizedKey,
      dedupeHash,
      title: titleFinal,
      slugCandidate: titleFinal,
      summary: summaryFinal,
      descriptionRaw: signal.rawText?.trim() || summaryFinal,
      website: websiteFinal,
      repoUrl: repoUrlFinal,
      ...(suggestedCategorySlug
        ? {
            suggestedType: suggestedCategorySlug,
            categoriesJson: [suggestedCategorySlug] as unknown as Prisma.InputJsonValue,
          }
        : {}),
      referenceSources: normalizeReferenceSources(signal.referenceSources) as unknown as Prisma.InputJsonValue,
      metadataJson: {
        fromSignal: true,
        signalId: signal.id,
        signalType: signal.signalType,
        aiAssisted: Boolean(overrides.aiInsightRaw),
        aiSuggestedCategory: suggestedCategorySlug,
        aiSimpleSummaryCandidate: overrides.simpleSummaryCandidate?.trim() || null,
        aiInsightRaw: overrides.aiInsightRaw ?? null,
      } as Prisma.InputJsonValue,
      rawPayloadJson: {
        signalTitle: signal.title,
        signalSummary: signal.summary,
        signalUrl: signal.url,
      } as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  await prisma.discoverySignal.update({
    where: { id: signal.id },
    data: {
      status: "CONVERTED",
      convertedCandidateId: candidate.id,
    },
  });

  return { candidateId: candidate.id };
}
