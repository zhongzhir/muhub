import type { DiscoveryReviewStatus, Prisma, PrismaClient } from "@prisma/client";
import { discoveryDedupeHashFromNormalizedKey } from "@/lib/discovery/dedupe-hash";
import { normalizeGithubRepoUrl } from "@/lib/discovery/normalize-url";
import type { GithubCandidatePayload } from "@/lib/discovery/map-github-repo";
import { persistReviewPriorityForCandidateId } from "@/lib/discovery/persist-review-priority";
import { scoreDiscoveryCandidate, tagsFromJson } from "@/lib/discovery/score-candidate";
import type { JsonValue } from "@/lib/discovery/types";
import { fallbackSlugBase, isValidProjectSlug, slugifyProjectName } from "@/lib/project-slug";

function asObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

function mergeRawWithTrendingSnapshot(
  previous: JsonValue | null | undefined,
  incoming: JsonValue,
  metrics: { stars: number; forks: number },
): JsonValue {
  const base = asObject(previous);
  const inc = asObject(incoming);
  const snaps = Array.isArray(base.trendingSnapshots)
    ? ([...base.trendingSnapshots] as unknown[])
    : [];
  snaps.push({
    at: new Date().toISOString(),
    stars: metrics.stars,
    forks: metrics.forks,
    full_name: inc.full_name,
  });
  return {
    ...base,
    ...inc,
    trendingSnapshots: snaps,
  } as JsonValue;
}

function shouldPreserveTextFields(review: DiscoveryReviewStatus): boolean {
  return review !== "PENDING";
}

async function findGithubCandidate(db: PrismaClient, payload: GithubCandidatePayload) {
  const byKey = await db.discoveryCandidate.findUnique({
    where: { normalizedKey: payload.normalizedKey },
  });
  if (byKey) {
    return byKey;
  }
  const byHash = await db.discoveryCandidate.findUnique({
    where: { dedupeHash: payload.dedupeHash },
  });
  if (byHash) {
    return byHash;
  }
  const norm = normalizeGithubRepoUrl(payload.repoUrl);
  return db.discoveryCandidate.findFirst({
    where: {
      OR: [{ repoUrl: norm }, { repoUrl: payload.repoUrl }],
    },
  });
}

export type UpsertGithubCandidateMode = "full" | "trending";

export async function upsertGithubDiscoveryCandidate(
  db: PrismaClient,
  args: {
    sourceId: string;
    sourceKey: string;
    runId: string;
    payload: GithubCandidatePayload;
    mode: UpsertGithubCandidateMode;
  },
): Promise<{ created: boolean }> {
  const { sourceId, sourceKey, runId, payload, mode } = args;
  const existing = await findGithubCandidate(db, payload);

  const tagList = tagsFromJson(payload.tagsJson);
  const scored = scoreDiscoveryCandidate({
    title: payload.title,
    summary: payload.summary,
    descriptionRaw: payload.descriptionRaw,
    website: payload.website,
    tags: tagList,
    stars: payload.stars,
    forks: payload.forks,
    watchers: payload.watchers,
    hasAvatar: Boolean(payload.avatarUrl?.trim()),
    repoUpdatedAt: payload.repoUpdatedAt,
    lastCommitAt: payload.lastCommitAt,
  });

  const baseScores = {
    score: scored.score,
    popularityScore: scored.popularityScore,
    freshnessScore: scored.freshnessScore,
    qualityScore: scored.qualityScore,
  };

  if (!existing) {
    const created = await db.discoveryCandidate.create({
      data: {
        sourceId,
        discoveryRunId: runId,
        externalType: payload.externalType,
        externalId: payload.externalId,
        externalUrl: payload.externalUrl,
        sourceKey,
        normalizedKey: payload.normalizedKey,
        dedupeHash: payload.dedupeHash,
        title: payload.title,
        slugCandidate: payload.slugCandidate,
        summary: payload.summary,
        descriptionRaw: payload.descriptionRaw,
        website: payload.website,
        repoUrl: normalizeGithubRepoUrl(payload.repoUrl),
        docsUrl: payload.docsUrl,
        twitterUrl: payload.twitterUrl,
        language: payload.language,
        openSourceLicense: payload.openSourceLicense,
        stars: payload.stars,
        forks: payload.forks,
        watchers: payload.watchers,
        issues: payload.issues,
        lastCommitAt: payload.lastCommitAt,
        repoCreatedAt: payload.repoCreatedAt,
        repoUpdatedAt: payload.repoUpdatedAt,
        ownerName: payload.ownerName,
        ownerUrl: payload.ownerUrl,
        avatarUrl: payload.avatarUrl,
        categoriesJson: payload.categoriesJson as Prisma.InputJsonValue,
        tagsJson: payload.tagsJson as Prisma.InputJsonValue,
        metadataJson: mode === "trending" ? { firstSeenVia: "trending" } : { firstSeenVia: "github" },
        rawPayloadJson: payload.rawPayloadJson as Prisma.InputJsonValue,
        enrichmentStatus: "OK",
        ...baseScores,
        lastSeenAt: new Date(),
      },
      select: { id: true },
    });
    await persistReviewPriorityForCandidateId(db, created.id);
    return { created: true };
  }

  if (mode === "trending") {
    const mergedRaw = mergeRawWithTrendingSnapshot(
      existing.rawPayloadJson as JsonValue | null,
      payload.rawPayloadJson as JsonValue,
      { stars: payload.stars, forks: payload.forks },
    );
    const meta = asObject(existing.metadataJson);
    const hits = Array.isArray(meta.trendingHits) ? [...meta.trendingHits] : [];
    hits.push({ at: new Date().toISOString(), stars: payload.stars });
    await db.discoveryCandidate.update({
      where: { id: existing.id },
      data: {
        discoveryRunId: runId,
        sourceKey,
        lastSeenAt: new Date(),
        stars: payload.stars,
        forks: payload.forks,
        watchers: payload.watchers,
        issues: payload.issues,
        lastCommitAt: payload.lastCommitAt,
        repoUpdatedAt: payload.repoUpdatedAt,
        rawPayloadJson: mergedRaw as Prisma.InputJsonValue,
        metadataJson: { ...meta, trendingHits: hits } as Prisma.InputJsonValue,
        ...baseScores,
        enrichmentStatus: "OK",
      },
    });
    await persistReviewPriorityForCandidateId(db, existing.id);
    return { created: false };
  }

  if (shouldPreserveTextFields(existing.reviewStatus)) {
    await db.discoveryCandidate.update({
      where: { id: existing.id },
      data: {
        sourceId,
        discoveryRunId: runId,
        sourceKey,
        lastSeenAt: new Date(),
        stars: payload.stars,
        forks: payload.forks,
        watchers: payload.watchers,
        issues: payload.issues,
        lastCommitAt: payload.lastCommitAt,
        repoCreatedAt: payload.repoCreatedAt,
        repoUpdatedAt: payload.repoUpdatedAt,
        avatarUrl: payload.avatarUrl ?? existing.avatarUrl,
        tagsJson: payload.tagsJson as Prisma.InputJsonValue,
        categoriesJson: payload.categoriesJson as Prisma.InputJsonValue,
        rawPayloadJson: {
          ...(asObject(existing.rawPayloadJson)),
          ...(asObject(payload.rawPayloadJson)),
          lastTopicSyncAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        ...baseScores,
        enrichmentStatus: "OK",
      },
    });
    await persistReviewPriorityForCandidateId(db, existing.id);
    return { created: false };
  }

  await db.discoveryCandidate.update({
    where: { id: existing.id },
    data: {
      sourceId,
      discoveryRunId: runId,
      externalType: payload.externalType,
      externalId: payload.externalId,
      externalUrl: payload.externalUrl,
      sourceKey,
      normalizedKey: payload.normalizedKey,
      dedupeHash: payload.dedupeHash,
      title: payload.title,
      slugCandidate: payload.slugCandidate,
      summary: payload.summary,
      descriptionRaw: payload.descriptionRaw,
      website: payload.website,
      repoUrl: normalizeGithubRepoUrl(payload.repoUrl),
      docsUrl: payload.docsUrl,
      twitterUrl: payload.twitterUrl,
      language: payload.language,
      openSourceLicense: payload.openSourceLicense,
      stars: payload.stars,
      forks: payload.forks,
      watchers: payload.watchers,
      issues: payload.issues,
      lastCommitAt: payload.lastCommitAt,
      repoCreatedAt: payload.repoCreatedAt,
      repoUpdatedAt: payload.repoUpdatedAt,
      ownerName: payload.ownerName,
      ownerUrl: payload.ownerUrl,
      avatarUrl: payload.avatarUrl,
      categoriesJson: payload.categoriesJson as Prisma.InputJsonValue,
      tagsJson: payload.tagsJson as Prisma.InputJsonValue,
      rawPayloadJson: payload.rawPayloadJson as Prisma.InputJsonValue,
      ...baseScores,
      lastSeenAt: new Date(),
      enrichmentStatus: "OK",
    },
  });
  await persistReviewPriorityForCandidateId(db, existing.id);
  return { created: false };
}

export type InstitutionCandidateMeta = {
  institutionName: string | null;
  institutionType: string | null;
  institutionRegion: string | null;
};

/** 机构目录页解析后的候选（externalType = INSTITUTION，metadataJson 含机构字段） */
export async function upsertInstitutionDiscoveryCandidate(
  db: PrismaClient,
  args: {
    sourceId: string;
    sourceKey: string;
    runId: string;
    name: string;
    description?: string | null;
    website: string;
    institutionMeta: InstitutionCandidateMeta;
    listUrl: string;
  },
): Promise<{ created: boolean }> {
  const { sourceId, sourceKey, runId, name, description, website, institutionMeta, listUrl } = args;

  const externalType = "INSTITUTION";
  const normUrl = website.split("#")[0]!.trim();
  const normalizedKey = `institution:${sourceKey}:${normUrl.toLowerCase()}`;
  const dedupeHash = discoveryDedupeHashFromNormalizedKey(normalizedKey);
  const externalId = dedupeHash.slice(0, 32);

  let slugBase = slugifyProjectName(name);
  if (!slugBase || !isValidProjectSlug(slugBase)) {
    slugBase = fallbackSlugBase();
  }

  const metadataJson = {
    institutionName: institutionMeta.institutionName,
    institutionType: institutionMeta.institutionType,
    institutionRegion: institutionMeta.institutionRegion,
    sourceListUrl: listUrl,
  };

  const rawPayloadJson = {
    institutionListingUrl: listUrl,
    scrapedName: name,
  };

  const scored = scoreDiscoveryCandidate({
    title: name,
    summary: description ?? null,
    descriptionRaw: description ?? null,
    website: normUrl,
    tags: [],
    stars: 0,
    forks: 0,
    watchers: 0,
    hasAvatar: false,
    repoUpdatedAt: null,
    lastCommitAt: null,
  });

  const existing =
    (await db.discoveryCandidate.findUnique({ where: { normalizedKey } })) ||
    (await db.discoveryCandidate.findUnique({ where: { dedupeHash } })) ||
    (await db.discoveryCandidate.findFirst({
      where: {
        externalType,
        website: normUrl,
        reviewStatus: { notIn: ["REJECTED", "IGNORED"] },
      },
    }));

  const baseScores = {
    score: scored.score,
    popularityScore: scored.popularityScore,
    freshnessScore: scored.freshnessScore,
    qualityScore: scored.qualityScore,
  };

  if (!existing) {
    const created = await db.discoveryCandidate.create({
      data: {
        sourceId,
        discoveryRunId: runId,
        externalType,
        externalId,
        externalUrl: normUrl,
        sourceKey,
        normalizedKey,
        dedupeHash,
        title: name.slice(0, 500),
        slugCandidate: slugBase,
        summary: description?.slice(0, 2000) ?? null,
        descriptionRaw: description?.slice(0, 8000) ?? null,
        website: normUrl,
        stars: 0,
        forks: 0,
        watchers: 0,
        issues: 0,
        metadataJson: metadataJson as Prisma.InputJsonValue,
        rawPayloadJson: rawPayloadJson as Prisma.InputJsonValue,
        enrichmentStatus: "PENDING",
        ...baseScores,
        lastSeenAt: new Date(),
      },
      select: { id: true },
    });
    await persistReviewPriorityForCandidateId(db, created.id);
    return { created: true };
  }

  const mergedMeta = { ...asObject(existing.metadataJson), ...metadataJson };
  const mergedRaw = {
    ...asObject(existing.rawPayloadJson),
    ...rawPayloadJson,
    lastInstitutionSyncAt: new Date().toISOString(),
  };

  if (shouldPreserveTextFields(existing.reviewStatus)) {
    await db.discoveryCandidate.update({
      where: { id: existing.id },
      data: {
        sourceId,
        discoveryRunId: runId,
        sourceKey,
        lastSeenAt: new Date(),
        website: normUrl,
        externalUrl: normUrl,
        metadataJson: mergedMeta as Prisma.InputJsonValue,
        rawPayloadJson: mergedRaw as Prisma.InputJsonValue,
        ...baseScores,
      },
    });
    await persistReviewPriorityForCandidateId(db, existing.id);
    return { created: false };
  }

  await db.discoveryCandidate.update({
    where: { id: existing.id },
    data: {
      sourceId,
      discoveryRunId: runId,
      externalType,
      externalId,
      externalUrl: normUrl,
      sourceKey,
      normalizedKey,
      dedupeHash,
      title: name.slice(0, 500),
      slugCandidate: slugBase,
      summary: description?.slice(0, 2000) ?? null,
      descriptionRaw: description?.slice(0, 8000) ?? null,
      website: normUrl,
      metadataJson: mergedMeta as Prisma.InputJsonValue,
      rawPayloadJson: mergedRaw as Prisma.InputJsonValue,
      ...baseScores,
      lastSeenAt: new Date(),
    },
  });
  await persistReviewPriorityForCandidateId(db, existing.id);
  return { created: false };
}
