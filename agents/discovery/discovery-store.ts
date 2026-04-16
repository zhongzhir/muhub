/**
 * 本地发现队列入库（data/discovery-items.json），最新条目写在数组前端。
 */

import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import type { Prisma } from "@prisma/client";
import {
  DiscoveryImportStatus,
  DiscoveryReviewStatus,
  DiscoverySourceType as PrismaDiscoverySourceType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

import type {
  DiscoveryAiStatus,
  DiscoveryItem,
  DiscoverySourceType,
  DiscoveryStatus,
} from "./discovery-types";
import {
  buildDiscoveryDedupeFields,
  findPossibleDuplicateByTitle,
  findStrongDuplicateItem,
  normalizeUrl,
} from "./discovery-dedupe";

const REL_PATH = join("data", "discovery-items.json");

const SOURCE_TYPES = new Set<DiscoverySourceType>([
  "github",
  "manual",
  "rss",
  "rss-producthunt",
  "rss-github",
  "twitter",
  "other",
]);
const STATUSES = new Set<DiscoveryStatus>(["new", "reviewed", "imported", "rejected"]);
const AI_STATUSES = new Set<DiscoveryAiStatus>(["scheduled", "done", "failed"]);
const DB_DISCOVERY_QUEUE_SOURCE_KEY = "json-discovery-queue";

function toDiscoverySourceType(raw: unknown): DiscoverySourceType {
  if (typeof raw !== "string") {
    return "other";
  }
  const normalized = raw.trim().toLowerCase();
  if (SOURCE_TYPES.has(normalized as DiscoverySourceType)) {
    return normalized as DiscoverySourceType;
  }
  if (normalized === "github") return "github";
  if (normalized === "manual") return "manual";
  if (normalized === "rss") return "rss";
  if (normalized === "rss-producthunt") return "rss-producthunt";
  if (normalized === "rss-github") return "rss-github";
  if (normalized === "twitter") return "twitter";
  return "other";
}

function filePath(): string {
  return join(process.cwd(), REL_PATH);
}

/** 用于去重：同 URL 视为同一候选项 */
export function normalizeDiscoveryUrl(url: string): string {
  const normalized = normalizeUrl(url);
  if (normalized) {
    return normalized.toLowerCase();
  }
  return url.trim().toLowerCase();
}

function coerceItem(raw: unknown): DiscoveryItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const o = raw as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    typeof o.title !== "string" ||
    typeof o.url !== "string" ||
    typeof o.createdAt !== "string"
  ) {
    return null;
  }
  const st = o.sourceType;
  const stat = o.status;
  if (typeof st !== "string" || !SOURCE_TYPES.has(st as DiscoverySourceType)) {
    return null;
  }
  if (typeof stat !== "string" || !STATUSES.has(stat as DiscoveryStatus)) {
    return null;
  }
  return {
    id: o.id,
    sourceType: st as DiscoverySourceType,
    title: o.title,
    url: o.url,
    normalizedUrl: typeof o.normalizedUrl === "string" ? o.normalizedUrl : undefined,
    githubRepoKey: typeof o.githubRepoKey === "string" ? o.githubRepoKey : undefined,
    websiteHost: typeof o.websiteHost === "string" ? o.websiteHost : undefined,
    duplicateOfId: typeof o.duplicateOfId === "string" ? o.duplicateOfId : undefined,
    duplicateProjectId: typeof o.duplicateProjectId === "string" ? o.duplicateProjectId : undefined,
    possibleDuplicate: typeof o.possibleDuplicate === "boolean" ? o.possibleDuplicate : undefined,
    description: typeof o.description === "string" ? o.description : undefined,
    meta:
      o.meta && typeof o.meta === "object" && !Array.isArray(o.meta)
        ? (o.meta as Record<string, unknown>)
        : undefined,
    projectSlug: typeof o.projectSlug === "string" ? o.projectSlug : undefined,
    status: stat as DiscoveryStatus,
    aiStatus:
      typeof o.aiStatus === "string" && AI_STATUSES.has(o.aiStatus as DiscoveryAiStatus)
        ? (o.aiStatus as DiscoveryAiStatus)
        : undefined,
    aiUpdatedAt: typeof o.aiUpdatedAt === "string" ? o.aiUpdatedAt : undefined,
    createdAt: o.createdAt,
  };
}

function safeParseArray(raw: string): unknown[] {
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function isDbEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function pickItemUrl(meta: Record<string, unknown> | undefined, fallback: string | null): string {
  const metaUrl = typeof meta?.url === "string" ? meta.url.trim() : "";
  if (metaUrl) {
    return metaUrl;
  }
  return fallback?.trim() || "";
}

function parseDiscoveryMeta(
  raw: unknown,
): {
  meta: Record<string, unknown> | undefined;
  sourceType: DiscoverySourceType;
  aiStatus?: DiscoveryAiStatus;
  aiUpdatedAt?: string;
  duplicateOfId?: string;
  duplicateProjectId?: string;
  possibleDuplicate?: boolean;
  normalizedUrl?: string;
  githubRepoKey?: string;
  websiteHost?: string;
  projectSlug?: string;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { meta: undefined, sourceType: "other" };
  }
  const row = raw as Record<string, unknown>;
  const sourceType = toDiscoverySourceType(row.sourceType);
  const aiStatusRaw = typeof row.aiStatus === "string" ? row.aiStatus : undefined;
  const aiStatus =
    aiStatusRaw && AI_STATUSES.has(aiStatusRaw as DiscoveryAiStatus)
      ? (aiStatusRaw as DiscoveryAiStatus)
      : undefined;
  const meta = row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
    ? (row.meta as Record<string, unknown>)
    : undefined;
  return {
    meta,
    sourceType,
    aiStatus,
    aiUpdatedAt: typeof row.aiUpdatedAt === "string" ? row.aiUpdatedAt : undefined,
    duplicateOfId: typeof row.duplicateOfId === "string" ? row.duplicateOfId : undefined,
    duplicateProjectId: typeof row.duplicateProjectId === "string" ? row.duplicateProjectId : undefined,
    possibleDuplicate: typeof row.possibleDuplicate === "boolean" ? row.possibleDuplicate : undefined,
    normalizedUrl: typeof row.normalizedUrl === "string" ? row.normalizedUrl : undefined,
    githubRepoKey: typeof row.githubRepoKey === "string" ? row.githubRepoKey : undefined,
    websiteHost: typeof row.websiteHost === "string" ? row.websiteHost : undefined,
    projectSlug: typeof row.projectSlug === "string" ? row.projectSlug : undefined,
  };
}

async function ensureDbDiscoveryQueueSource() {
  return prisma.discoverySource.upsert({
    where: { key: DB_DISCOVERY_QUEUE_SOURCE_KEY },
    update: {},
    create: {
      key: DB_DISCOVERY_QUEUE_SOURCE_KEY,
      name: "JSON Discovery Queue",
      type: PrismaDiscoverySourceType.GITHUB,
      subtype: "json-queue",
      status: "ACTIVE",
      configJson: { mode: "json-compatible" },
    },
    select: { id: true },
  });
}

function mapDbStatus(reviewStatus: DiscoveryReviewStatus, importStatus: DiscoveryImportStatus): DiscoveryStatus {
  if (importStatus === "IMPORTED") {
    return "imported";
  }
  if (reviewStatus === "REJECTED") {
    return "rejected";
  }
  if (reviewStatus === "APPROVED" || reviewStatus === "MERGED") {
    return "reviewed";
  }
  return "new";
}

async function readDbList(): Promise<DiscoveryItem[]> {
  const rows = await prisma.discoveryCandidate.findMany({
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: {
      id: true,
      title: true,
      externalUrl: true,
      repoUrl: true,
      website: true,
      summary: true,
      metadataJson: true,
      reviewStatus: true,
      importStatus: true,
      createdAt: true,
      matchedProject: { select: { id: true, slug: true } },
    },
  });
  return rows.map((row) => {
    const parsed = parseDiscoveryMeta(row.metadataJson);
    const url = pickItemUrl(parsed.meta, row.externalUrl || row.repoUrl || row.website || "");
    return {
      id: row.id,
      sourceType: parsed.sourceType,
      title: row.title,
      url,
      normalizedUrl: parsed.normalizedUrl,
      githubRepoKey: parsed.githubRepoKey,
      websiteHost: parsed.websiteHost,
      duplicateOfId: parsed.duplicateOfId,
      duplicateProjectId: parsed.duplicateProjectId ?? row.matchedProject?.id ?? undefined,
      possibleDuplicate: parsed.possibleDuplicate,
      description: row.summary ?? parsed.meta?.description?.toString(),
      meta: parsed.meta,
      projectSlug: parsed.projectSlug ?? row.matchedProject?.slug ?? undefined,
      status: mapDbStatus(row.reviewStatus, row.importStatus),
      aiStatus: parsed.aiStatus,
      aiUpdatedAt: parsed.aiUpdatedAt,
      createdAt: row.createdAt.toISOString(),
    } satisfies DiscoveryItem;
  });
}

async function findDbById(id: string): Promise<DiscoveryItem | null> {
  const row = await prisma.discoveryCandidate.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      externalUrl: true,
      repoUrl: true,
      website: true,
      summary: true,
      metadataJson: true,
      reviewStatus: true,
      importStatus: true,
      createdAt: true,
      matchedProject: { select: { id: true, slug: true } },
    },
  });
  if (!row) {
    return null;
  }
  const parsed = parseDiscoveryMeta(row.metadataJson);
  return {
    id: row.id,
    sourceType: parsed.sourceType,
    title: row.title,
    url: pickItemUrl(parsed.meta, row.externalUrl || row.repoUrl || row.website || ""),
    normalizedUrl: parsed.normalizedUrl,
    githubRepoKey: parsed.githubRepoKey,
    websiteHost: parsed.websiteHost,
    duplicateOfId: parsed.duplicateOfId,
    duplicateProjectId: parsed.duplicateProjectId ?? row.matchedProject?.id ?? undefined,
    possibleDuplicate: parsed.possibleDuplicate,
    description: row.summary ?? parsed.meta?.description?.toString(),
    meta: parsed.meta,
    projectSlug: parsed.projectSlug ?? row.matchedProject?.slug ?? undefined,
    status: mapDbStatus(row.reviewStatus, row.importStatus),
    aiStatus: parsed.aiStatus,
    aiUpdatedAt: parsed.aiUpdatedAt,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapStatusToDb(status: DiscoveryStatus): { reviewStatus?: DiscoveryReviewStatus; importStatus?: DiscoveryImportStatus } {
  if (status === "imported") {
    return { reviewStatus: "APPROVED", importStatus: "IMPORTED" };
  }
  if (status === "reviewed") {
    return { reviewStatus: "APPROVED", importStatus: "PENDING" };
  }
  if (status === "rejected") {
    return { reviewStatus: "REJECTED", importStatus: "PENDING" };
  }
  return { reviewStatus: "PENDING", importStatus: "PENDING" };
}

/** 确保 data 目录与 discovery-items.json 存在（缺省为 []）。 */
export async function ensureDiscoveryStoreFile(): Promise<void> {
  const path = filePath();
  await mkdir(dirname(path), { recursive: true });
  try {
    await readFile(path, "utf8");
  } catch {
    await writeFile(path, "[]\n", "utf8");
  }
}

async function readRawList(): Promise<DiscoveryItem[]> {
  await ensureDiscoveryStoreFile();
  const path = filePath();
  let raw = "[]";
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return [];
  }
  const arr = safeParseArray(raw);
  const out: DiscoveryItem[] = [];
  for (const row of arr) {
    const item = coerceItem(row);
    if (item) {
      out.push(item);
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * 读取队列（按 createdAt 倒序；解析失败的行被跳过）。
 */
export async function readDiscoveryItems(): Promise<DiscoveryItem[]> {
  if (isDbEnabled()) {
    return readDbList();
  }
  return readRawList();
}

export async function readDiscoveryItemById(id: string): Promise<DiscoveryItem | null> {
  if (isDbEnabled()) {
    return findDbById(id);
  }
  const list = await readRawList();
  return list.find((x) => x.id === id) ?? null;
}

export async function findDiscoveryItemByUrl(url: string): Promise<DiscoveryItem | null> {
  if (isDbEnabled()) {
    const key = normalizeDiscoveryUrl(url);
    const row = await prisma.discoveryCandidate.findFirst({
      where: {
        OR: [{ externalUrl: key }, { repoUrl: key }, { website: key }],
      },
      select: { id: true },
    });
    if (!row) {
      return null;
    }
    return findDbById(row.id);
  }
  const key = normalizeDiscoveryUrl(url);
  const list = await readRawList();
  return list.find((i) => normalizeDiscoveryUrl(i.url) === key) ?? null;
}

/**
 * 将一条记录插入队列头部；若同 normalize URL 已存在则跳过写入。
 */
export async function appendDiscoveryItem(item: DiscoveryItem): Promise<{ duplicate: boolean }> {
  if (isDbEnabled()) {
    const source = await ensureDbDiscoveryQueueSource();
    const dedupeFields = buildDiscoveryDedupeFields(item);
    const prepared: DiscoveryItem = {
      ...item,
      ...dedupeFields,
    };
    const existing = await findDiscoveryItemByUrl(prepared.url);
    if (existing) {
      return { duplicate: true };
    }
    const url = normalizeDiscoveryUrl(prepared.url);
    const { reviewStatus, importStatus } = mapStatusToDb(prepared.status);
    const existingMeta = prepared.meta ?? {};
    await prisma.discoveryCandidate.create({
      data: {
        id: prepared.id,
        sourceId: source.id,
        sourceKey: prepared.sourceType,
        externalType: prepared.sourceType,
        externalUrl: url,
        repoUrl: prepared.githubRepoKey ? url : null,
        website: prepared.websiteHost ? url : null,
        title: prepared.title,
        summary: prepared.description ?? null,
        metadataJson: {
          sourceType: prepared.sourceType,
          meta: existingMeta,
          aiStatus: prepared.aiStatus ?? null,
          aiUpdatedAt: prepared.aiUpdatedAt ?? null,
          duplicateOfId: prepared.duplicateOfId ?? null,
          duplicateProjectId: prepared.duplicateProjectId ?? null,
          possibleDuplicate: prepared.possibleDuplicate ?? false,
          normalizedUrl: prepared.normalizedUrl ?? normalizeUrl(prepared.url),
          githubRepoKey: prepared.githubRepoKey ?? null,
          websiteHost: prepared.websiteHost ?? null,
          projectSlug: prepared.projectSlug ?? null,
          url: prepared.url,
        } as Prisma.InputJsonValue,
        reviewStatus: reviewStatus ?? "PENDING",
        importStatus: importStatus ?? "PENDING",
        createdAt: new Date(prepared.createdAt),
        firstSeenAt: new Date(prepared.createdAt),
        lastSeenAt: new Date(prepared.createdAt),
      },
    });
    return { duplicate: false };
  }
  await ensureDiscoveryStoreFile();
  const path = filePath();
  const list = await readRawList();
  const dedupeFields = buildDiscoveryDedupeFields(item);
  const prepared: DiscoveryItem = {
    ...item,
    ...dedupeFields,
  };
  const strongDup = findStrongDuplicateItem(list, prepared);
  if (strongDup) {
    return { duplicate: true };
  }
  const weakDup = findPossibleDuplicateByTitle(list, prepared);
  const nextItem: DiscoveryItem = weakDup
    ? { ...prepared, possibleDuplicate: true }
    : prepared;
  const next = [nextItem, ...list];
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return { duplicate: false };
}

export async function updateDiscoveryStatus(id: string, status: DiscoveryStatus): Promise<boolean> {
  if (!STATUSES.has(status)) {
    return false;
  }
  if (isDbEnabled()) {
    const row = await prisma.discoveryCandidate.findUnique({ where: { id }, select: { id: true } });
    if (!row) {
      return false;
    }
    const mapped = mapStatusToDb(status);
    await prisma.discoveryCandidate.update({
      where: { id },
      data: {
        reviewStatus: mapped.reviewStatus,
        importStatus: mapped.importStatus,
      },
    });
    return true;
  }
  await ensureDiscoveryStoreFile();
  const path = filePath();
  const list = await readRawList();
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) {
    return false;
  }
  const next = list.map((x) => (x.id === id ? { ...x, status } : x));
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return true;
}

/** 导入成功后回写 status=imported 与 projectSlug */
export async function updateDiscoveryItemImportResult(
  id: string,
  projectSlug: string,
): Promise<boolean> {
  if (isDbEnabled()) {
    const slug = projectSlug.trim();
    if (!slug) {
      return false;
    }
    const project = await prisma.project.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, slug: true },
    });
    if (!project) {
      return false;
    }
    const row = await prisma.discoveryCandidate.findUnique({
      where: { id },
      select: { metadataJson: true },
    });
    if (!row) {
      return false;
    }
    const parsed = parseDiscoveryMeta(row.metadataJson);
    await prisma.discoveryCandidate.update({
      where: { id },
      data: {
        reviewStatus: "APPROVED",
        importStatus: "IMPORTED",
        matchedProjectId: project.id,
        metadataJson: {
          sourceType: parsed.sourceType,
          meta: parsed.meta ?? {},
          aiStatus: parsed.aiStatus ?? null,
          aiUpdatedAt: parsed.aiUpdatedAt ?? null,
          duplicateOfId: parsed.duplicateOfId ?? null,
          duplicateProjectId: parsed.duplicateProjectId ?? null,
          possibleDuplicate: parsed.possibleDuplicate ?? false,
          normalizedUrl: parsed.normalizedUrl ?? null,
          githubRepoKey: parsed.githubRepoKey ?? null,
          websiteHost: parsed.websiteHost ?? null,
          projectSlug: project.slug,
          url: pickItemUrl(parsed.meta, ""),
        } as Prisma.InputJsonValue,
      },
    });
    return true;
  }
  await ensureDiscoveryStoreFile();
  const path = filePath();
  const list = await readRawList();
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) {
    return false;
  }
  const slug = projectSlug.trim();
  if (!slug) {
    return false;
  }
  const next = list.map((x) =>
    x.id === id ? { ...x, status: "imported" as DiscoveryStatus, projectSlug: slug } : x,
  );
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return true;
}

/** 关联到已存在 Project 时回写重复信息（不标记 imported）。 */
export async function updateDiscoveryItemDuplicateResult(
  id: string,
  duplicateProjectId: string,
  duplicateProjectSlug: string,
): Promise<boolean> {
  if (isDbEnabled()) {
    const dupId = duplicateProjectId.trim();
    const dupSlug = duplicateProjectSlug.trim();
    if (!dupId || !dupSlug) {
      return false;
    }
    const row = await prisma.discoveryCandidate.findUnique({
      where: { id },
      select: { metadataJson: true },
    });
    if (!row) {
      return false;
    }
    const parsed = parseDiscoveryMeta(row.metadataJson);
    await prisma.discoveryCandidate.update({
      where: { id },
      data: {
        reviewStatus: "APPROVED",
        importStatus: "SKIPPED",
        matchedProjectId: dupId,
        metadataJson: {
          sourceType: parsed.sourceType,
          meta: parsed.meta ?? {},
          aiStatus: parsed.aiStatus ?? null,
          aiUpdatedAt: parsed.aiUpdatedAt ?? null,
          duplicateOfId: dupSlug,
          duplicateProjectId: dupId,
          possibleDuplicate: true,
          normalizedUrl: parsed.normalizedUrl ?? null,
          githubRepoKey: parsed.githubRepoKey ?? null,
          websiteHost: parsed.websiteHost ?? null,
          projectSlug: dupSlug,
          url: pickItemUrl(parsed.meta, ""),
        } as Prisma.InputJsonValue,
      },
    });
    return true;
  }
  await ensureDiscoveryStoreFile();
  const path = filePath();
  const list = await readRawList();
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) {
    return false;
  }
  const dupId = duplicateProjectId.trim();
  const dupSlug = duplicateProjectSlug.trim();
  if (!dupId || !dupSlug) {
    return false;
  }
  const next = list.map((x) =>
    x.id === id
      ? {
          ...x,
          status: "reviewed" as DiscoveryStatus,
          duplicateOfId: dupSlug,
          duplicateProjectId: dupId,
          possibleDuplicate: true,
        }
      : x,
  );
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return true;
}

/** 回写 AI enrich 状态与时间 */
export async function updateDiscoveryAiStatus(
  id: string,
  status: DiscoveryAiStatus,
): Promise<boolean> {
  if (!AI_STATUSES.has(status)) {
    return false;
  }
  if (isDbEnabled()) {
    const row = await prisma.discoveryCandidate.findUnique({
      where: { id },
      select: { metadataJson: true },
    });
    if (!row) {
      return false;
    }
    const parsed = parseDiscoveryMeta(row.metadataJson);
    const now = new Date().toISOString();
    await prisma.discoveryCandidate.update({
      where: { id },
      data: {
        metadataJson: {
          sourceType: parsed.sourceType,
          meta: parsed.meta ?? {},
          aiStatus: status,
          aiUpdatedAt: now,
          duplicateOfId: parsed.duplicateOfId ?? null,
          duplicateProjectId: parsed.duplicateProjectId ?? null,
          possibleDuplicate: parsed.possibleDuplicate ?? false,
          normalizedUrl: parsed.normalizedUrl ?? null,
          githubRepoKey: parsed.githubRepoKey ?? null,
          websiteHost: parsed.websiteHost ?? null,
          projectSlug: parsed.projectSlug ?? null,
          url: pickItemUrl(parsed.meta, ""),
        } as Prisma.InputJsonValue,
      },
    });
    return true;
  }
  await ensureDiscoveryStoreFile();
  const path = filePath();
  const list = await readRawList();
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) {
    return false;
  }
  const now = new Date().toISOString();
  const next = list.map((x) =>
    x.id === id ? { ...x, aiStatus: status, aiUpdatedAt: now } : x,
  );
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return true;
}
