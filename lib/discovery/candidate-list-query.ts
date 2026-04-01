import type {
  DiscoveryClassificationStatus,
  DiscoveryImportStatus,
  DiscoveryReviewStatus,
  DiscoverySourceType,
  Prisma,
} from "@prisma/client";
import { Prisma as PrismaRuntime } from "@prisma/client";
import {
  DISCOVERY_FRESH_MAX_AGE_DAYS,
  DISCOVERY_POPULAR_MIN_STARS,
  DISCOVERY_RECENT_COMMIT_MAX_AGE_DAYS,
} from "@/lib/discovery/candidate-quality-signals";

export const DISCOVERY_REVIEW_STATUSES: DiscoveryReviewStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "IGNORED",
  "MERGED",
];

export const DISCOVERY_IMPORT_STATUSES: DiscoveryImportStatus[] = [
  "PENDING",
  "IMPORTED",
  "SKIPPED",
  "FAILED",
];

export const DISCOVERY_CLASSIFICATION_STATUSES: DiscoveryClassificationStatus[] = [
  "PENDING",
  "DONE",
  "FAILED",
  "ACCEPTED",
];

export const DISCOVERY_SOURCE_TYPES: DiscoverySourceType[] = ["GITHUB", "PRODUCTHUNT", "INSTITUTION"];

export type DiscoveryCandidateSortField =
  | "score"
  | "reviewPriority"
  | "stars"
  | "lastSeenAt"
  | "repoUpdatedAt"
  | "firstSeenAt";

function parseBool(v: string | null | undefined): boolean | undefined {
  if (v === "true" || v === "1") {
    return true;
  }
  if (v === "false" || v === "0") {
    return false;
  }
  return undefined;
}

function nonEmptyStringField(
  field: "website" | "docsUrl" | "twitterUrl" | "repoUrl",
): Prisma.DiscoveryCandidateWhereInput {
  return {
    AND: [
      { [field]: { not: null } },
      { NOT: { [field]: { equals: "" } } },
    ],
  };
}

/**
 * 从查询串构造 Prisma where（管理端列表与 GET /api/admin/discovery/candidates 共用）
 */
export function discoveryCandidateWhereFromSearchParams(
  sp: URLSearchParams,
): Prisma.DiscoveryCandidateWhereInput {
  const parts: Prisma.DiscoveryCandidateWhereInput[] = [];

  const sourceId = sp.get("sourceId")?.trim();
  if (sourceId) {
    parts.push({ sourceId });
  }

  const sourceKey = sp.get("sourceKey")?.trim();
  if (sourceKey) {
    parts.push({ source: { key: sourceKey } });
  }

  const sourceType = sp.get("sourceType")?.trim();
  if (sourceType && DISCOVERY_SOURCE_TYPES.includes(sourceType as DiscoverySourceType)) {
    parts.push({ source: { type: sourceType as DiscoverySourceType } });
  }

  const rs = sp.get("reviewStatus")?.trim();
  if (rs && DISCOVERY_REVIEW_STATUSES.includes(rs as DiscoveryReviewStatus)) {
    parts.push({ reviewStatus: rs as DiscoveryReviewStatus });
  }

  const im = sp.get("importStatus")?.trim();
  if (im && DISCOVERY_IMPORT_STATUSES.includes(im as DiscoveryImportStatus)) {
    parts.push({ importStatus: im as DiscoveryImportStatus });
  }

  const externalType = sp.get("externalType")?.trim();
  if (externalType) {
    parts.push({ externalType });
  }

  const language = sp.get("language")?.trim();
  if (language) {
    parts.push({
      language: { equals: language, mode: "insensitive" },
    });
  }

  const hasWebsite = parseBool(sp.get("hasWebsite"));
  if (hasWebsite === true) {
    parts.push(nonEmptyStringField("website"));
  } else if (hasWebsite === false) {
    parts.push({
      OR: [{ website: null }, { website: "" }],
    });
  }

  const hasDocs = parseBool(sp.get("hasDocs"));
  if (hasDocs === true) {
    parts.push(nonEmptyStringField("docsUrl"));
  } else if (hasDocs === false) {
    parts.push({
      OR: [{ docsUrl: null }, { docsUrl: "" }],
    });
  }

  const hasTwitter = parseBool(sp.get("hasTwitter"));
  if (hasTwitter === true) {
    parts.push(nonEmptyStringField("twitterUrl"));
  } else if (hasTwitter === false) {
    parts.push({
      OR: [{ twitterUrl: null }, { twitterUrl: "" }],
    });
  }

  const hasRepo = parseBool(sp.get("hasRepo"));
  if (hasRepo === true) {
    parts.push(nonEmptyStringField("repoUrl"));
  } else if (hasRepo === false) {
    parts.push({
      OR: [{ repoUrl: null }, { repoUrl: "" }],
    });
  }

  const minStars = Number(sp.get("minStars"));
  if (Number.isFinite(minStars) && minStars > 0) {
    parts.push({ stars: { gte: Math.floor(minStars) } });
  }

  const days = Number(sp.get("updatedWithinDays"));
  if (Number.isFinite(days) && days > 0) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    parts.push({
      OR: [{ repoUpdatedAt: { gte: since } }, { lastCommitAt: { gte: since } }],
    });
  }

  const isPopular = parseBool(sp.get("isPopular"));
  if (isPopular === true) {
    parts.push({ stars: { gte: DISCOVERY_POPULAR_MIN_STARS } });
  } else if (isPopular === false) {
    parts.push({ stars: { lt: DISCOVERY_POPULAR_MIN_STARS } });
  }

  const isFresh = parseBool(sp.get("isFresh"));
  if (isFresh === true) {
    const since = new Date(Date.now() - DISCOVERY_FRESH_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    parts.push({
      OR: [{ repoUpdatedAt: { gte: since } }, { lastCommitAt: { gte: since } }],
    });
  } else if (isFresh === false) {
    const since = new Date(Date.now() - DISCOVERY_FRESH_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    parts.push({
      AND: [
        { OR: [{ repoUpdatedAt: null }, { repoUpdatedAt: { lt: since } }] },
        { OR: [{ lastCommitAt: null }, { lastCommitAt: { lt: since } }] },
      ],
    });
  }

  const hasRecentCommit = parseBool(sp.get("hasRecentCommit"));
  if (hasRecentCommit === true) {
    const since = new Date(
      Date.now() - DISCOVERY_RECENT_COMMIT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    );
    parts.push({ lastCommitAt: { gte: since } });
  } else if (hasRecentCommit === false) {
    const since = new Date(
      Date.now() - DISCOVERY_RECENT_COMMIT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    );
    parts.push({
      OR: [{ lastCommitAt: null }, { lastCommitAt: { lt: since } }],
    });
  }

  const hasDescription = parseBool(sp.get("hasDescription"));
  if (hasDescription === true) {
    parts.push({
      OR: [
        {
          AND: [
            { descriptionRaw: { not: null } },
            { NOT: { descriptionRaw: { equals: "" } } },
          ],
        },
        {
          AND: [
            { summary: { not: null } },
            { NOT: { summary: { equals: "" } } },
          ],
        },
      ],
    });
  } else if (hasDescription === false) {
    parts.push({
      AND: [
        { OR: [{ descriptionRaw: null }, { descriptionRaw: "" }] },
        { OR: [{ summary: null }, { summary: "" }] },
      ],
    });
  }

  const classificationStatus = sp.get("classificationStatus")?.trim();
  if (
    classificationStatus &&
    DISCOVERY_CLASSIFICATION_STATUSES.includes(
      classificationStatus as DiscoveryClassificationStatus,
    )
  ) {
    parts.push({
      classificationStatus: classificationStatus as DiscoveryClassificationStatus,
    });
  }

  /** 低优先级 + 信息极少，辅助批量清理（不改变 reject/ignore 语义） */
  const lowSignal = parseBool(sp.get("lowSignal"));
  if (lowSignal === true) {
    parts.push({
      reviewStatus: "PENDING",
      importStatus: "PENDING",
      reviewPriorityScore: { lte: 16 },
      stars: { lte: 3 },
      AND: [
        { OR: [{ website: null }, { website: "" }] },
        { OR: [{ repoUrl: null }, { repoUrl: "" }] },
        { OR: [{ summary: null }, { summary: "" }] },
        { OR: [{ descriptionRaw: null }, { descriptionRaw: "" }] },
      ],
    });
  }

  const suggestedTypeFilter = sp.get("suggestedType")?.trim();
  if (suggestedTypeFilter) {
    parts.push({ suggestedType: suggestedTypeFilter });
  }

  const isAiRelatedF = parseBool(sp.get("isAiRelated"));
  if (isAiRelatedF === true) {
    parts.push({ isAiRelated: true });
  } else if (isAiRelatedF === false) {
    parts.push({ OR: [{ isAiRelated: false }, { isAiRelated: null }] });
  }

  const isChineseToolF = parseBool(sp.get("isChineseTool"));
  if (isChineseToolF === true) {
    parts.push({ isChineseTool: true });
  } else if (isChineseToolF === false) {
    parts.push({ OR: [{ isChineseTool: false }, { isChineseTool: null }] });
  }

  const hasTopics = parseBool(sp.get("hasTopics"));
  if (hasTopics === true) {
    parts.push({
      AND: [
        { tagsJson: { not: PrismaRuntime.DbNull } },
        { NOT: { tagsJson: { equals: [] as PrismaRuntime.InputJsonValue } } },
      ],
    });
  } else if (hasTopics === false) {
    parts.push({
      OR: [
        { tagsJson: { equals: PrismaRuntime.DbNull } },
        { tagsJson: { equals: [] as PrismaRuntime.InputJsonValue } },
      ],
    });
  }

  if (parts.length === 0) {
    return {};
  }
  if (parts.length === 1) {
    return parts[0]!;
  }
  return { AND: parts };
}

export function discoveryCandidateOrderByFromParams(
  sortRaw: string | null | undefined,
  orderRaw: string | null | undefined,
): Prisma.DiscoveryCandidateOrderByWithRelationInput {
  const order = orderRaw === "asc" ? "asc" : "desc";
  const sort = (sortRaw ?? "score").trim();

  const field: DiscoveryCandidateSortField =
    sort === "reviewPriority" ||
    sort === "stars" ||
    sort === "lastSeenAt" ||
    sort === "repoUpdatedAt" ||
    sort === "firstSeenAt"
      ? sort
      : "score";

  if (field === "reviewPriority") {
    return { reviewPriorityScore: order };
  }
  if (field === "repoUpdatedAt") {
    return { repoUpdatedAt: order };
  }
  if (field === "firstSeenAt") {
    return { firstSeenAt: order };
  }
  if (field === "stars") {
    return { stars: order };
  }
  if (field === "lastSeenAt") {
    return { lastSeenAt: order };
  }
  return { score: order };
}

/** 将 Next.js searchParams 对象转为 URLSearchParams（仅 string 值） */
export function nextSearchParamsToURLSearchParams(
  sp: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) {
      continue;
    }
    if (Array.isArray(v)) {
      v.forEach((x) => u.append(k, String(x)));
    } else if (v !== "") {
      u.set(k, v);
    }
  }
  return u;
}
