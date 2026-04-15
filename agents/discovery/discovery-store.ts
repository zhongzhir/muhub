/**
 * 本地发现队列入库（data/discovery-items.json），最新条目写在数组前端。
 */

import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";

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
  return readRawList();
}

export async function readDiscoveryItemById(id: string): Promise<DiscoveryItem | null> {
  const list = await readRawList();
  return list.find((x) => x.id === id) ?? null;
}

export async function findDiscoveryItemByUrl(url: string): Promise<DiscoveryItem | null> {
  const key = normalizeDiscoveryUrl(url);
  const list = await readRawList();
  return list.find((i) => normalizeDiscoveryUrl(i.url) === key) ?? null;
}

/**
 * 将一条记录插入队列头部；若同 normalize URL 已存在则跳过写入。
 */
export async function appendDiscoveryItem(item: DiscoveryItem): Promise<{ duplicate: boolean }> {
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
