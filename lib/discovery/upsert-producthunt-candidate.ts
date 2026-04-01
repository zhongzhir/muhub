import type { DiscoveryReviewStatus, Prisma, PrismaClient } from "@prisma/client";
import type { ProductHuntCandidatePayload } from "@/lib/discovery/producthunt/map-producthunt-item";
import { persistReviewPriorityForCandidateId } from "@/lib/discovery/persist-review-priority";
import { normalizeGithubRepoUrl, normalizeWebsiteHost } from "@/lib/discovery/normalize-url";
import { scoreDiscoveryCandidate, tagsFromJson } from "@/lib/discovery/score-candidate";
import type { JsonValue } from "@/lib/discovery/types";

function normalizeGithubRepoUrlSafe(raw: string): string {
  try {
    return normalizeGithubRepoUrl(raw);
  } catch {
    return raw.trim();
  }
}

function asObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

function shouldPreserveTextFields(review: DiscoveryReviewStatus): boolean {
  return review !== "PENDING";
}

async function findProductHuntExisting(
  db: PrismaClient,
  payload: ProductHuntCandidatePayload,
) {
  const byPhId = await db.discoveryCandidate.findFirst({
    where: {
      externalType: "producthunt_product",
      externalId: payload.externalId,
    },
  });
  if (byPhId) {
    return byPhId;
  }

  const byNorm = await db.discoveryCandidate.findUnique({
    where: { normalizedKey: payload.normalizedKey },
  });
  if (byNorm) {
    return byNorm;
  }

  const byHash = await db.discoveryCandidate.findUnique({
    where: { dedupeHash: payload.dedupeHash },
  });
  if (byHash) {
    return byHash;
  }

  if (payload.repoUrl?.trim()) {
    const norm = normalizeGithubRepoUrlSafe(payload.repoUrl);
    const gh = await db.discoveryCandidate.findFirst({
      where: {
        OR: [{ repoUrl: norm }, { repoUrl: payload.repoUrl.trim() }],
        reviewStatus: { notIn: ["REJECTED", "IGNORED"] },
      },
    });
    if (gh) {
      return gh;
    }
  }

  if (payload.websiteHost) {
    const recent = await db.discoveryCandidate.findMany({
      where: {
        website: { not: null },
        NOT: { website: "" },
        reviewStatus: { notIn: ["REJECTED", "IGNORED"] },
      },
      select: {
        id: true,
        website: true,
        externalType: true,
        externalId: true,
      },
      take: 1000,
      orderBy: { lastSeenAt: "desc" },
    });
    const matches = recent.filter(
      (r) => normalizeWebsiteHost(r.website) === payload.websiteHost,
    );
    if (matches.length === 1) {
      return db.discoveryCandidate.findUnique({ where: { id: matches[0]!.id } });
    }
  }

  return null;
}

function mergeJsonMeta(prev: JsonValue | null | undefined, add: JsonValue): JsonValue {
  return { ...asObject(prev), ...asObject(add) } as JsonValue;
}

function mergeTopicTags(existing: unknown, incoming: string[]): Prisma.InputJsonValue {
  const base = Array.isArray(existing)
    ? (existing as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  return [...new Set([...base, ...incoming])] as Prisma.InputJsonValue;
}

export async function upsertProductHuntDiscoveryCandidate(
  db: PrismaClient,
  args: {
    sourceId: string;
    sourceKey: string;
    runId: string;
    payload: ProductHuntCandidatePayload;
  },
): Promise<{ created: boolean }> {
  const { sourceId, sourceKey, runId, payload } = args;
  const existing = await findProductHuntExisting(db, payload);

  const tagList = tagsFromJson(payload.tagsJson);
  const scored = scoreDiscoveryCandidate({
    title: payload.title,
    summary: payload.summary,
    descriptionRaw: payload.descriptionRaw,
    website: payload.website,
    tags: tagList,
    stars: payload.votesCount,
    forks: 0,
    watchers: 0,
    hasAvatar: Boolean(payload.avatarUrl?.trim()),
    repoUpdatedAt: payload.launchAt,
    lastCommitAt: payload.launchAt,
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
        repoUrl: payload.repoUrl ? normalizeGithubRepoUrlSafe(payload.repoUrl) : null,
        tagsJson: payload.tagsJson as Prisma.InputJsonValue,
        categoriesJson: payload.categoriesJson as Prisma.InputJsonValue,
        metadataJson: payload.metadataJson as Prisma.InputJsonValue,
        rawPayloadJson: payload.rawPayloadJson as Prisma.InputJsonValue,
        avatarUrl: payload.avatarUrl,
        stars: payload.votesCount,
        enrichmentStatus: "OK",
        ...baseScores,
        lastSeenAt: new Date(),
      },
      select: { id: true },
    });
    await persistReviewPriorityForCandidateId(db, created.id);
    return { created: true };
  }

  const isGithubLinked =
    Boolean(existing.repoUrl?.trim()) || existing.externalType.toLowerCase() === "github";
  const isProductHuntRow = existing.externalType === "producthunt_product";

  if (isGithubLinked && !isProductHuntRow) {
    const prevMeta = asObject(existing.metadataJson);
    const prevPh = asObject(prevMeta.productHunt);
    const incomingPh = asObject(asObject(payload.metadataJson).productHunt);
    const phHistory = Array.isArray(prevPh.snapshots)
      ? ([...prevPh.snapshots] as unknown[])
      : [];
    phHistory.push({
      at: new Date().toISOString(),
      sourceKey,
      postId: payload.externalId,
      url: payload.externalUrl,
      votes: payload.votesCount,
    });
    await db.discoveryCandidate.update({
      where: { id: existing.id },
      data: {
        discoveryRunId: runId,
        sourceKey,
        lastSeenAt: new Date(),
        tagsJson: mergeTopicTags(existing.tagsJson, tagList),
        metadataJson: {
          ...prevMeta,
          productHunt: { ...prevPh, ...incomingPh, snapshots: phHistory },
        } as Prisma.InputJsonValue,
        rawPayloadJson: {
          ...asObject(existing.rawPayloadJson),
          lastProductHuntSyncAt: new Date().toISOString(),
          producthunt: payload.rawPayloadJson,
        } as Prisma.InputJsonValue,
        enrichmentStatus: "OK",
        ...baseScores,
      },
    });
    await persistReviewPriorityForCandidateId(db, existing.id);
    return { created: false };
  }

  if (!isProductHuntRow) {
    const meta = mergeJsonMeta(existing.metadataJson as JsonValue | null, payload.metadataJson);
    await db.discoveryCandidate.update({
      where: { id: existing.id },
      data: {
        discoveryRunId: runId,
        sourceKey,
        lastSeenAt: new Date(),
        tagsJson: mergeTopicTags(existing.tagsJson, tagList),
        metadataJson: meta as Prisma.InputJsonValue,
        rawPayloadJson: {
          ...asObject(existing.rawPayloadJson),
          producthuntSupplement: payload.rawPayloadJson,
        } as Prisma.InputJsonValue,
        enrichmentStatus: "OK",
        stars: existing.stars > 0 ? existing.stars : payload.votesCount,
        ...baseScores,
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
        externalUrl: payload.externalUrl,
        stars: payload.votesCount,
        tagsJson: mergeTopicTags(existing.tagsJson, tagList),
        metadataJson: mergeJsonMeta(
          existing.metadataJson as JsonValue | null,
          payload.metadataJson,
        ) as Prisma.InputJsonValue,
        rawPayloadJson: {
          ...asObject(existing.rawPayloadJson),
          ...asObject(payload.rawPayloadJson),
          lastProductHuntSyncAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        avatarUrl: payload.avatarUrl ?? existing.avatarUrl,
        repoUrl: payload.repoUrl
          ? normalizeGithubRepoUrlSafe(payload.repoUrl)
          : existing.repoUrl,
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
      repoUrl: payload.repoUrl ? normalizeGithubRepoUrlSafe(payload.repoUrl) : null,
      tagsJson: payload.tagsJson as Prisma.InputJsonValue,
      categoriesJson: payload.categoriesJson as Prisma.InputJsonValue,
      metadataJson: payload.metadataJson as Prisma.InputJsonValue,
      rawPayloadJson: payload.rawPayloadJson as Prisma.InputJsonValue,
      avatarUrl: payload.avatarUrl,
      stars: payload.votesCount,
      ...baseScores,
      lastSeenAt: new Date(),
      enrichmentStatus: "OK",
    },
  });
  await persistReviewPriorityForCandidateId(db, existing.id);
  return { created: false };
}
