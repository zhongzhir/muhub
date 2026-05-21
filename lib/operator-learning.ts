import fs from "node:fs/promises";
import path from "node:path";

import type { KnowledgeCategory } from "@/lib/project-knowledge";

const CACHE_DIR = path.join(process.cwd(), ".cache", "operator-learning");
const CORRECTIONS_FILE = path.join(CACHE_DIR, "corrections.json");
const RULES_FILE = path.join(CACHE_DIR, "rules.json");

export type OperatorCorrectionType =
  | "category_change"
  | "tag_add"
  | "tag_remove"
  | "source_visibility_change";

export type OperatorCorrection = {
  id: string;
  timestamp: string;
  projectId: string;
  projectName?: string;
  type: OperatorCorrectionType;
  before: unknown;
  after: unknown;
  signalTags?: string[];
  signalText?: string;
};

export type OperatorLearningRules = {
  version: "v1";
  updatedAt: string;
  /** signal token → category slug boost */
  categoryBoosts: Record<string, Partial<Record<string, number>>>;
  /** signal token → category slug penalty */
  categoryPenalties: Record<string, Partial<Record<string, number>>>;
  correctionCount: number;
};

function normalizeSignalToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function slugFromCategoryValue(value: string): string {
  const map: Record<string, string> = {
    AI_AGENT: "ai_agent",
    AI_IMAGE: "design_creative",
    AI_VIDEO: "content_media",
    AI_WRITING: "content_media",
    DEV_TOOL: "developer_tool",
    PRODUCTIVITY: "productivity",
    SEARCH: "other",
    EDUCATION: "education_learning",
    FINANCE: "finance_investment",
    DATA_TOOL: "data_model",
    ai_agent: "ai_agent",
    design_creative: "design_creative",
    content_media: "content_media",
    developer_tool: "developer_tool",
    productivity: "productivity",
    education_learning: "education_learning",
    finance_investment: "finance_investment",
    data_model: "data_model",
    other: "other",
  };
  return map[value] ?? value;
}

function knowledgeFromSlug(slug: string): KnowledgeCategory | null {
  const map: Record<string, KnowledgeCategory> = {
    ai_agent: "AI_AGENT",
    design_creative: "AI_IMAGE",
    content_media: "AI_VIDEO",
    developer_tool: "DEV_TOOL",
    productivity: "PRODUCTIVITY",
    education_learning: "EDUCATION",
    finance_investment: "FINANCE",
    data_model: "DATA_TOOL",
    other: "SEARCH",
  };
  return map[slug] ?? null;
}

async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await ensureCacheDir();
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function defaultRules(): OperatorLearningRules {
  return {
    version: "v1",
    updatedAt: new Date().toISOString(),
    categoryBoosts: {},
    categoryPenalties: {},
    correctionCount: 0,
  };
}

export async function loadOperatorLearningRules(): Promise<OperatorLearningRules> {
  return readJsonFile(RULES_FILE, defaultRules());
}

export async function loadOperatorCorrections(limit = 200): Promise<OperatorCorrection[]> {
  const all = await readJsonFile<OperatorCorrection[]>(CORRECTIONS_FILE, []);
  return all.slice(-limit);
}

async function appendCorrection(correction: OperatorCorrection): Promise<void> {
  const all = await readJsonFile<OperatorCorrection[]>(CORRECTIONS_FILE, []);
  all.push(correction);
  const trimmed = all.slice(-500);
  await writeJsonFile(CORRECTIONS_FILE, trimmed);
}

function bumpRuleMap(
  map: Record<string, Partial<Record<string, number>>>,
  signal: string,
  categorySlug: string,
  delta: number,
): void {
  if (!map[signal]) {
    map[signal] = {};
  }
  map[signal][categorySlug] = (map[signal][categorySlug] ?? 0) + delta;
}

async function learnFromCategoryChange(input: {
  beforeCategory: string;
  afterCategory: string;
  signalTags?: string[];
  signalText?: string;
}): Promise<void> {
  const beforeSlug = slugFromCategoryValue(input.beforeCategory);
  const afterSlug = slugFromCategoryValue(input.afterCategory);
  if (!beforeSlug || !afterSlug || beforeSlug === afterSlug) {
    return;
  }

  const rules = await loadOperatorLearningRules();
  const signals = new Set<string>();
  for (const tag of input.signalTags ?? []) {
    signals.add(normalizeSignalToken(tag));
  }
  for (const token of (input.signalText ?? "").toLowerCase().split(/[^a-z0-9\u4e00-\u9fff+-]+/)) {
    if (token.length >= 3) {
      signals.add(normalizeSignalToken(token));
    }
  }

  for (const signal of signals) {
    if (!signal) {
      continue;
    }
    bumpRuleMap(rules.categoryBoosts, signal, afterSlug, 2);
    bumpRuleMap(rules.categoryPenalties, signal, beforeSlug, 2);
  }

  rules.correctionCount += 1;
  rules.updatedAt = new Date().toISOString();
  await writeJsonFile(RULES_FILE, rules);
}

export async function recordOperatorCategoryChange(input: {
  projectId: string;
  projectName?: string;
  beforeCategory: string | null;
  afterCategory: string | null;
  signalTags?: string[];
  signalText?: string;
}): Promise<void> {
  const before = input.beforeCategory?.trim() || "";
  const after = input.afterCategory?.trim() || "";
  if (!before || !after || before === after) {
    return;
  }

  await appendCorrection({
    id: `${Date.now()}-${input.projectId}`,
    timestamp: new Date().toISOString(),
    projectId: input.projectId,
    projectName: input.projectName,
    type: "category_change",
    before: { category: before },
    after: { category: after },
    signalTags: input.signalTags,
    signalText: input.signalText,
  });

  await learnFromCategoryChange({
    beforeCategory: before,
    afterCategory: after,
    signalTags: input.signalTags,
    signalText: input.signalText,
  });
}

export async function recordOperatorTagChanges(input: {
  projectId: string;
  projectName?: string;
  beforeTags: string[];
  afterTags: string[];
}): Promise<void> {
  const beforeSet = new Set(input.beforeTags.map((t) => t.trim()).filter(Boolean));
  const afterSet = new Set(input.afterTags.map((t) => t.trim()).filter(Boolean));
  const added = [...afterSet].filter((tag) => !beforeSet.has(tag));
  const removed = [...beforeSet].filter((tag) => !afterSet.has(tag));

  for (const tag of added) {
    await appendCorrection({
      id: `${Date.now()}-add-${input.projectId}-${tag}`,
      timestamp: new Date().toISOString(),
      projectId: input.projectId,
      projectName: input.projectName,
      type: "tag_add",
      before: null,
      after: { tag },
      signalTags: input.afterTags,
    });
  }
  for (const tag of removed) {
    await appendCorrection({
      id: `${Date.now()}-rm-${input.projectId}-${tag}`,
      timestamp: new Date().toISOString(),
      projectId: input.projectId,
      projectName: input.projectName,
      type: "tag_remove",
      before: { tag },
      after: null,
      signalTags: input.afterTags,
    });
  }
}

export async function recordOperatorSourceVisibilityChange(input: {
  projectId: string;
  projectName?: string;
  sourceId: string;
  beforeVisibility: string | null;
  afterVisibility: string | null;
}): Promise<void> {
  const before = input.beforeVisibility?.trim() || "";
  const after = input.afterVisibility?.trim() || "";
  if (!before || !after || before === after) {
    return;
  }
  await appendCorrection({
    id: `${Date.now()}-vis-${input.sourceId}`,
    timestamp: new Date().toISOString(),
    projectId: input.projectId,
    projectName: input.projectName,
    type: "source_visibility_change",
    before: { sourceId: input.sourceId, visibility: before },
    after: { sourceId: input.sourceId, visibility: after },
  });
}

let cachedRules: OperatorLearningRules | null = null;
let cacheLoadedAt = 0;

async function getCachedRules(): Promise<OperatorLearningRules> {
  if (!cachedRules || Date.now() - cacheLoadedAt > 30_000) {
    cachedRules = await loadOperatorLearningRules();
    cacheLoadedAt = Date.now();
  }
  return cachedRules;
}

export function applyOperatorLearningToCategoryScores(
  semanticText: string,
  scores: Partial<Record<KnowledgeCategory, number>>,
): void {
  if (!cachedRules) {
    void getCachedRules();
    return;
  }
  const tokens = semanticText
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff+-]+/)
    .map(normalizeSignalToken)
    .filter(Boolean);

  for (const token of tokens) {
    const boosts = cachedRules.categoryBoosts[token];
    if (boosts) {
      for (const [slug, amount] of Object.entries(boosts)) {
        const cat = knowledgeFromSlug(slug);
        if (cat && amount) {
          scores[cat] = (scores[cat] ?? 0) + amount;
        }
      }
    }
    const penalties = cachedRules.categoryPenalties[token];
    if (penalties) {
      for (const [slug, amount] of Object.entries(penalties)) {
        const cat = knowledgeFromSlug(slug);
        if (cat && amount) {
          scores[cat] = (scores[cat] ?? 0) - amount;
        }
      }
    }
  }
}

export async function warmOperatorLearningCache(): Promise<void> {
  cachedRules = await getCachedRules();
  cacheLoadedAt = Date.now();
}

/** 供测试/初始化：写入示例运营者修正规则 */
export async function seedOperatorLearningVoiceExample(): Promise<void> {
  const rules = defaultRules();
  for (const signal of ["voice-cloning", "tts", "speech", "voice", "配音", "声音克隆"]) {
    bumpRuleMap(rules.categoryBoosts, signal, "design_creative", 4);
    bumpRuleMap(rules.categoryPenalties, signal, "ai_agent", 4);
  }
  rules.correctionCount = 3;
  rules.updatedAt = new Date().toISOString();
  await writeJsonFile(RULES_FILE, rules);
}
