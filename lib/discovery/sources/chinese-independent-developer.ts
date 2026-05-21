import fs from "node:fs/promises";
import path from "node:path";

import { fetchTextWithRetry } from "@/lib/fetch-with-retry";
import { normalizeGithubRepoUrlOrNull } from "@/lib/discovery/normalize-url";
import { parseProjectSourceUrl } from "@/lib/project-source-url";
import { parseRepoUrl } from "@/lib/repo-platform";

export const CHINESE_INDIE_SOURCE_KEY = "chinese-independent-developer";
export const CHINESE_INDIE_SOURCE_NAME = "中国独立开发者项目列表";
export const CHINESE_INDIE_SOURCE_REPO_URL =
  "https://github.com/zhongzhir/chinese-independent-developer";
export const CHINESE_INDIE_RAW_BASE_URL =
  "https://raw.githubusercontent.com/zhongzhir/chinese-independent-developer/master";

export const CHINESE_INDIE_FILES = {
  main: "README.md",
  programmer: "README-Programmer-Edition.md",
  game: "README-Game.md",
} as const;

export const CHINESE_INDIE_DEFAULT_EDITION: ChineseIndieEdition = "main";

export const CHINESE_INDIE_INCLUDED_FILES = [CHINESE_INDIE_FILES.main] as const;

export const CHINESE_INDIE_EXCLUDED_FILES = [
  CHINESE_INDIE_FILES.programmer,
  CHINESE_INDIE_FILES.game,
] as const;

export type ChineseIndieEdition = keyof typeof CHINESE_INDIE_FILES;
export type ChineseIndieStatus = "ONLINE" | "DEVELOPING" | "CLOSED";

export type ChineseIndieDeveloperLink = {
  label: string;
  url: string;
};

export type ChineseIndieRawEntry = {
  edition: ChineseIndieEdition;
  addedDate: string | null;
  developerName: string;
  developerRegion: string | null;
  developerLinks: ChineseIndieDeveloperLink[];
  originalStatus: ChineseIndieStatus;
  projectName: string;
  projectUrl: string;
  description: string | null;
  moreInfoUrls: string[];
  originalMarkdown: string;
};

export type ChineseIndieCandidateInput = {
  name: string;
  description: string | null;
  websiteUrl: string | null;
  githubUrl: string | null;
  sourceType: "curated_repository";
  sourceName: string;
  sourceUrl: string;
  sourceArticleUrl: string;
  edition: ChineseIndieEdition;
  originalStatus: ChineseIndieStatus;
  meta: {
    edition: ChineseIndieEdition;
    developerName: string;
    developerRegion: string | null;
    developerLinks: ChineseIndieDeveloperLink[];
    addedDate: string | null;
    originalStatus: ChineseIndieStatus;
    originalMarkdown: string;
    trustLevel: "curated";
    moreInfoUrls: string[];
    sourceRepo: string;
    autoImportAllowed: boolean;
  };
};

export type ChineseIndieFetchedFile = {
  edition: ChineseIndieEdition;
  fileName: string;
  rawUrl: string;
  markdown: string | null;
  error: string | null;
  /** 网络失败但命中本地缓存时的 warning，不阻断解析 */
  warning?: string | null;
  fromCache?: boolean;
};

const CHINESE_INDIE_CACHE_DIR = path.join(
  process.cwd(),
  ".cache/discovery/chinese-independent-developer",
);
const CHINESE_INDIE_FETCH_TIMEOUT_MS = 30_000;
const CHINESE_INDIE_FETCH_RETRY_DELAYS_MS = [2_000, 5_000, 10_000] as const;

function chineseIndieForceRefresh(): boolean {
  const raw = process.env.FORCE_REFRESH?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function chineseIndieCachePath(fileName: string): string {
  return path.join(CHINESE_INDIE_CACHE_DIR, fileName);
}

async function readChineseIndieCachedMarkdown(fileName: string): Promise<string | null> {
  if (chineseIndieForceRefresh()) {
    return null;
  }
  try {
    const markdown = await fs.readFile(chineseIndieCachePath(fileName), "utf8");
    return markdown.trim() ? markdown : null;
  } catch {
    return null;
  }
}

async function writeChineseIndieCachedMarkdown(fileName: string, markdown: string): Promise<void> {
  await fs.mkdir(CHINESE_INDIE_CACHE_DIR, { recursive: true });
  await fs.writeFile(chineseIndieCachePath(fileName), markdown, "utf8");
}

async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchChineseIndieRawMarkdownOnce(
  rawUrl: string,
): Promise<{ ok: true; markdown: string } | { ok: false; error: string }> {
  const resp = await fetchTextWithRetry(rawUrl, {
    timeoutMs: CHINESE_INDIE_FETCH_TIMEOUT_MS,
    retries: 0,
    headers: {
      Accept: "text/plain",
      "User-Agent": "MUHUB-Chinese-Indie-Importer",
    },
  });
  if (!resp.ok) {
    return { ok: false, error: resp.error ?? `HTTP ${resp.status}` };
  }
  const markdown = resp.text ?? "";
  if (!markdown.trim()) {
    return { ok: false, error: "empty markdown" };
  }
  return { ok: true, markdown };
}

async function fetchChineseIndieRawMarkdownWithRetry(input: {
  fileName: string;
  rawUrl: string;
}): Promise<{
  markdown: string | null;
  error: string | null;
  warning: string | null;
  fromCache: boolean;
}> {
  const maxAttempts = CHINESE_INDIE_FETCH_RETRY_DELAYS_MS.length + 1;
  let lastError = "unknown fetch error";

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await sleepMs(CHINESE_INDIE_FETCH_RETRY_DELAYS_MS[attempt - 1]!);
    }
    const result = await fetchChineseIndieRawMarkdownOnce(input.rawUrl);
    if (result.ok) {
      await writeChineseIndieCachedMarkdown(input.fileName, result.markdown);
      return {
        markdown: result.markdown,
        error: null,
        warning: null,
        fromCache: false,
      };
    }
    lastError = result.error;
    console.warn(
      `[chinese-indie] fetch failed (${input.fileName}) attempt ${attempt + 1}/${maxAttempts}: ${lastError}`,
    );
  }

  const cached = await readChineseIndieCachedMarkdown(input.fileName);
  if (cached) {
    const warning = `using cached chinese indie markdown (${input.fileName}): ${lastError}`;
    console.warn(`[chinese-indie] ${warning}`);
    return {
      markdown: cached,
      error: null,
      warning,
      fromCache: true,
    };
  }

  return {
    markdown: null,
    error: lastError,
    warning: null,
    fromCache: false,
  };
}

const DATE_SECTION_RE = /^###\s+(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*号添加/u;
const DEVELOPER_SECTION_RE = /^####\s+(.+)$/u;
const PROJECT_LINE_RE =
  /^[\*\-]\s+:(white_check_mark|clock8|x):\s+\[([^\]]+)\]\(([^)]+)\)(?:[：:]\s*(.*))?$/u;
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

function statusFromEmoji(token: string): ChineseIndieStatus {
  if (token === "white_check_mark") return "ONLINE";
  if (token === "clock8") return "DEVELOPING";
  return "CLOSED";
}

function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("http")) {
    return null;
  }
  try {
    return new URL(trimmed).href;
  } catch {
    return null;
  }
}

function parseDeveloperHeader(line: string): {
  developerName: string;
  developerRegion: string | null;
  developerLinks: ChineseIndieDeveloperLink[];
} {
  const body = line.trim();
  const dashIndex = body.indexOf(" - ");
  const namePart = (dashIndex >= 0 ? body.slice(0, dashIndex) : body).trim();
  const linksPart = dashIndex >= 0 ? body.slice(dashIndex + 3).trim() : "";

  let developerName = namePart.replace(/^@+/u, "").trim();
  let developerRegion: string | null = null;
  const regionMatch = developerName.match(/^(.+?)\(([^)]+)\)$/u);
  if (regionMatch) {
    developerName = regionMatch[1].trim();
    developerRegion = regionMatch[2].trim() || null;
  }

  const developerLinks: ChineseIndieDeveloperLink[] = [];
  if (linksPart) {
    for (const match of linksPart.matchAll(MARKDOWN_LINK_RE)) {
      const label = match[1]?.trim();
      const url = normalizeHttpUrl(match[2] ?? "");
      if (label && url) {
        developerLinks.push({ label, url });
      }
    }
  }

  return { developerName, developerRegion, developerLinks };
}

function splitDescriptionTail(input: string | null | undefined): {
  description: string | null;
  moreInfoUrls: string[];
} {
  if (!input?.trim()) {
    return { description: null, moreInfoUrls: [] };
  }
  let text = input.trim();
  const moreInfoUrls: string[] = [];
  const tailLinkRe = /\s*-\s*\[[^\]]+\]\(([^)]+)\)\s*$/u;
  while (true) {
    const match = text.match(tailLinkRe);
    if (!match?.[1]) {
      break;
    }
    const url = normalizeHttpUrl(match[1]);
    if (url) {
      moreInfoUrls.unshift(url);
    }
    text = text.slice(0, match.index).trim();
  }
  return {
    description: text || null,
    moreInfoUrls,
  };
}

function isChineseIndieListRepoUrl(url: string): boolean {
  return /github\.com\/(?:1c7|zhongzhir)\/chinese-independent-developer(?:\/|$)/i.test(url);
}

function isAuxiliaryProjectUrl(url: string): boolean {
  if (isChineseIndieListRepoUrl(url)) {
    return false;
  }
  if (/github\.com\/[^/]+\/[^/]+\/(issues|pull|discussions|wiki|commit|releases|actions)(?:\/|$)/i.test(url)) {
    return false;
  }
  if (/github\.com\/[^/]+\/?$/i.test(url)) {
    return false;
  }
  return true;
}

function projectUrlsFromEntry(entry: Pick<ChineseIndieRawEntry, "projectUrl" | "moreInfoUrls">): {
  githubUrl: string | null;
  websiteUrl: string | null;
} {
  let githubUrl: string | null = null;
  let websiteUrl: string | null = null;

  const assignUrl = (raw: string, allowAuxiliary: boolean) => {
    if (allowAuxiliary && !isAuxiliaryProjectUrl(raw)) {
      return;
    }
    const url = normalizeHttpUrl(raw);
    if (!url) {
      return;
    }
    const repo = parseRepoUrl(url);
    if (repo?.platform === "github") {
      const normalized = normalizeGithubRepoUrlOrNull(url);
      if (normalized && !githubUrl) {
        githubUrl = normalized;
      }
      return;
    }
    if (repo?.platform === "gitee") {
      if (!githubUrl) {
        githubUrl = url;
      }
      return;
    }
    const parsed = parseProjectSourceUrl(url);
    if (parsed?.type === "GITHUB") {
      const normalized = normalizeGithubRepoUrlOrNull(parsed.url);
      if (normalized && !githubUrl) {
        githubUrl = normalized;
      }
      return;
    }
    if (parsed?.type === "GITCC") {
      if (!websiteUrl) {
        websiteUrl = parsed.url;
      }
      return;
    }
    if (!websiteUrl) {
      websiteUrl = url;
    }
  };

  assignUrl(entry.projectUrl, false);
  for (const moreInfoUrl of entry.moreInfoUrls) {
    assignUrl(moreInfoUrl, true);
  }

  return { githubUrl, websiteUrl };
}

export function parseChineseIndependentDeveloperMarkdown(
  markdown: string,
  edition: ChineseIndieEdition,
): ChineseIndieRawEntry[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const entries: ChineseIndieRawEntry[] = [];
  let currentDate: string | null = null;
  let currentDeveloper: ReturnType<typeof parseDeveloperHeader> | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const dateMatch = line.match(DATE_SECTION_RE);
    if (dateMatch) {
      currentDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
      currentDeveloper = null;
      continue;
    }

    const developerMatch = line.match(DEVELOPER_SECTION_RE);
    if (developerMatch?.[1]) {
      currentDeveloper = parseDeveloperHeader(developerMatch[1]);
      continue;
    }

    const projectMatch = line.match(PROJECT_LINE_RE);
    if (!projectMatch || !currentDeveloper) {
      continue;
    }

    const projectUrl = normalizeHttpUrl(projectMatch[3] ?? "");
    if (!projectUrl) {
      continue;
    }

    const tail = splitDescriptionTail(projectMatch[4]);
    entries.push({
      edition,
      addedDate: currentDate,
      developerName: currentDeveloper.developerName,
      developerRegion: currentDeveloper.developerRegion,
      developerLinks: currentDeveloper.developerLinks,
      originalStatus: statusFromEmoji(projectMatch[1] ?? "x"),
      projectName: projectMatch[2]?.trim() || "未命名项目",
      projectUrl,
      description: tail.description,
      moreInfoUrls: tail.moreInfoUrls,
      originalMarkdown: line.trim(),
    });
  }

  return entries;
}

export function normalizeChineseIndieProjectEntry(
  entry: ChineseIndieRawEntry,
  sourceArticleUrl: string,
): ChineseIndieCandidateInput {
  const { githubUrl, websiteUrl } = projectUrlsFromEntry(entry);
  const autoImportAllowed =
    entry.edition === "main" &&
    entry.originalStatus === "ONLINE" &&
    Boolean(githubUrl || websiteUrl) &&
    (entry.description?.trim().length ?? 0) >= 10;

  return {
    name: entry.projectName,
    description: entry.description,
    websiteUrl,
    githubUrl,
    sourceType: "curated_repository",
    sourceName: CHINESE_INDIE_SOURCE_NAME,
    sourceUrl: CHINESE_INDIE_SOURCE_REPO_URL,
    sourceArticleUrl,
    edition: entry.edition,
    originalStatus: entry.originalStatus,
    meta: {
      edition: entry.edition,
      developerName: entry.developerName,
      developerRegion: entry.developerRegion,
      developerLinks: entry.developerLinks,
      addedDate: entry.addedDate,
      originalStatus: entry.originalStatus,
      originalMarkdown: entry.originalMarkdown,
      trustLevel: "curated",
      moreInfoUrls: entry.moreInfoUrls,
      sourceRepo: CHINESE_INDIE_SOURCE_REPO_URL,
      autoImportAllowed,
    },
  };
}

export async function fetchChineseIndependentDeveloperFiles(
  editions: ChineseIndieEdition[] = [CHINESE_INDIE_DEFAULT_EDITION],
): Promise<ChineseIndieFetchedFile[]> {
  const results: ChineseIndieFetchedFile[] = [];

  for (const edition of editions) {
    const fileName = CHINESE_INDIE_FILES[edition];
    const rawUrl = `${CHINESE_INDIE_RAW_BASE_URL}/${fileName}`;
    const fetched = await fetchChineseIndieRawMarkdownWithRetry({ fileName, rawUrl });
    results.push({
      edition,
      fileName,
      rawUrl,
      markdown: fetched.markdown,
      error: fetched.error,
      warning: fetched.warning,
      fromCache: fetched.fromCache,
    });
  }

  return results;
}

export function parseChineseIndependentDeveloperFiles(
  files: ChineseIndieFetchedFile[],
): {
  entries: ChineseIndieCandidateInput[];
  parsedByEdition: Record<ChineseIndieEdition, number>;
  errors: Array<{ edition: ChineseIndieEdition; fileName: string; error: string }>;
} {
  const parsedByEdition: Record<ChineseIndieEdition, number> = {
    main: 0,
    programmer: 0,
    game: 0,
  };
  const errors: Array<{ edition: ChineseIndieEdition; fileName: string; error: string }> = [];
  const entries: ChineseIndieCandidateInput[] = [];

  for (const file of files) {
    if (file.warning) {
      errors.push({
        edition: file.edition,
        fileName: file.fileName,
        error: file.warning,
      });
    }
    if (file.error || !file.markdown) {
      if (!file.markdown) {
        errors.push({
          edition: file.edition,
          fileName: file.fileName,
          error: file.error ?? "empty markdown",
        });
      }
      continue;
    }
    const rawEntries = parseChineseIndependentDeveloperMarkdown(file.markdown, file.edition);
    parsedByEdition[file.edition] = rawEntries.length;
    for (const rawEntry of rawEntries) {
      entries.push(normalizeChineseIndieProjectEntry(rawEntry, file.rawUrl));
    }
  }

  return { entries, parsedByEdition, errors };
}

export function shouldAutoImportChineseIndieCandidate(input: ChineseIndieCandidateInput): boolean {
  return (
    input.edition === "main" &&
    input.originalStatus === "ONLINE" &&
    Boolean(input.githubUrl || input.websiteUrl) &&
    (input.description?.trim().length ?? 0) >= 10
  );
}

export function isAutoImportEligibleEntry(
  entry: ChineseIndieCandidateInput,
  options?: { isDuplicate?: boolean },
): boolean {
  if (options?.isDuplicate) {
    return false;
  }
  return shouldAutoImportChineseIndieCandidate(entry);
}

export function countEstimatedAutoImportable(
  entries: ChineseIndieCandidateInput[],
  duplicateNames: Set<string>,
): number {
  let count = 0;
  for (const entry of entries) {
    const dupKey = `${entry.name.trim().toLowerCase()}::${entry.edition}`;
    if (isAutoImportEligibleEntry(entry, { isDuplicate: duplicateNames.has(dupKey) })) {
      count += 1;
    }
  }
  return count;
}

export function resolveChineseIndieEditions(
  edition?: ChineseIndieEdition | "all",
): ChineseIndieEdition[] {
  const resolved = edition ?? CHINESE_INDIE_DEFAULT_EDITION;
  if (resolved === "all") {
    return ["main", "programmer", "game"];
  }
  return [resolved];
}
