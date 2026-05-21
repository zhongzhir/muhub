import type { KnowledgeCategory } from "@/lib/project-knowledge";
import type { ProjectCategory } from "@/lib/projects/project-categories";
import { getProjectCategoryLabel } from "@/lib/projects/project-categories";
import { applyOperatorLearningToCategoryScores, warmOperatorLearningCache } from "@/lib/operator-learning";

const KNOWLEDGE_TO_PROJECT_SLUG: Record<KnowledgeCategory, ProjectCategory> = {
  AI_VIDEO: "content_media",
  AI_IMAGE: "design_creative",
  AI_AGENT: "ai_agent",
  AI_WRITING: "content_media",
  DEV_TOOL: "developer_tool",
  PRODUCTIVITY: "productivity",
  SEARCH: "other",
  EDUCATION: "education_learning",
  FINANCE: "finance_investment",
  DATA_TOOL: "data_model",
};

function knowledgeCategoryToProjectSlug(category: KnowledgeCategory): ProjectCategory {
  return KNOWLEDGE_TO_PROJECT_SLUG[category];
}

export type CategoryConfidence = "high" | "medium" | "low";

export type CategorySemanticInput = {
  aiSuggestedCategory: string;
  projectName?: string | null;
  tagline?: string | null;
  description?: string | null;
  tags?: string[];
  techSignals?: string[];
  targetUsers?: string[];
  useCases?: string[];
  highlights?: string[];
  whatItIs?: string | null;
  summary?: string | null;
};

export type CategoryDecisionResult = {
  knowledgeCategory: KnowledgeCategory;
  projectSlug: ProjectCategory;
  categoryConfidence: CategoryConfidence;
  needsCategoryReview: boolean;
  reason: string;
  scores: Partial<Record<KnowledgeCategory, number>>;
};

const ALL_CATEGORIES: KnowledgeCategory[] = [
  "AI_VIDEO",
  "AI_IMAGE",
  "AI_AGENT",
  "AI_WRITING",
  "DEV_TOOL",
  "PRODUCTIVITY",
  "SEARCH",
  "EDUCATION",
  "FINANCE",
  "DATA_TOOL",
];

const AGENT_STRONG_SIGNALS = [
  "autonomous workflow",
  "multi-step execution",
  "multi step execution",
  "task orchestration",
  "agent loop",
  "tool use",
  "memory",
  "planner",
  "executor",
  "orchestrat",
  "multi-agent",
  "multi agent",
  "agentic",
  "自主工作流",
  "多步执行",
  "任务编排",
  "智能体循环",
  "工具调用",
  "记忆",
];

const AGENT_WEAK_SIGNALS = ["agent", "智能体", "ai agent", "ai-agent"];

const VOICE_MEDIA_SIGNALS = [
  "voice",
  "tts",
  "text-to-speech",
  "text to speech",
  "speech",
  "clone",
  "cloning",
  "dubbing",
  "配音",
  "语音",
  "声音克隆",
  "文本转语音",
  "speech synthesis",
];

const VIDEO_SIGNALS = ["video", "视频", "animation", "动画", "seedance", "runway"];
const IMAGE_SIGNALS = ["image", "图像", "picture", "photo", "design", "设计", "creative", "创意"];
const DEV_TOOL_SIGNALS = [
  "developer",
  "dev tool",
  "sdk",
  "cli",
  "ide",
  "debug",
  "开发工具",
  "程序员",
  "代码",
  "github",
];
const WRITING_SIGNALS = ["writing", "copywriting", "文案", "写作", "blog", "article"];
const DATA_SIGNALS = ["data", "dataset", "analytics", "数据库", "数据分析", "etl"];
const SEARCH_SIGNALS = ["search", "检索", "搜索引擎", "index"];
const EDUCATION_SIGNALS = ["education", "learning", "course", "教育", "学习", "教程"];
const FINANCE_SIGNALS = ["finance", "payment", "invoice", "金融", "支付", "理财"];

function normalizeAiCategory(raw: string): KnowledgeCategory | null {
  const token = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if ((ALL_CATEGORIES as readonly string[]).includes(token)) {
    return token as KnowledgeCategory;
  }
  const slugMap: Record<string, KnowledgeCategory> = {
    AI_AGENT: "AI_AGENT",
    AI_VIDEO: "AI_VIDEO",
    AI_IMAGE: "AI_IMAGE",
    AI_WRITING: "AI_WRITING",
    DEV_TOOL: "DEV_TOOL",
    PRODUCTIVITY: "PRODUCTIVITY",
    SEARCH: "SEARCH",
    EDUCATION: "EDUCATION",
    FINANCE: "FINANCE",
    DATA_TOOL: "DATA_TOOL",
    AI_AGENTS: "AI_AGENT",
    DESIGN: "AI_IMAGE",
    DESIGN_CREATIVE: "AI_IMAGE",
    DESIGN_TOOL: "AI_IMAGE",
    CONTENT_MEDIA: "AI_VIDEO",
    DEVELOPER_TOOL: "DEV_TOOL",
    DATA_MODEL: "DATA_TOOL",
  };
  return slugMap[token] ?? null;
}

function buildSemanticText(input: CategorySemanticInput): string {
  return [
    input.projectName,
    input.tagline,
    input.description,
    input.whatItIs,
    input.summary,
    ...(input.tags ?? []),
    ...(input.techSignals ?? []),
    ...(input.targetUsers ?? []),
    ...(input.useCases ?? []),
    ...(input.highlights ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function countSignals(text: string, signals: string[]): number {
  let count = 0;
  for (const signal of signals) {
    if (text.includes(signal.toLowerCase())) {
      count += 1;
    }
  }
  return count;
}

function initScores(aiCategory: KnowledgeCategory | null): Partial<Record<KnowledgeCategory, number>> {
  const scores: Partial<Record<KnowledgeCategory, number>> = {};
  for (const cat of ALL_CATEGORIES) {
    scores[cat] = 10;
  }
  if (aiCategory) {
    scores[aiCategory] = (scores[aiCategory] ?? 10) + 25;
  }
  return scores;
}

function bump(
  scores: Partial<Record<KnowledgeCategory, number>>,
  category: KnowledgeCategory,
  amount: number,
): void {
  scores[category] = (scores[category] ?? 0) + amount;
}

function pickBestCategory(
  scores: Partial<Record<KnowledgeCategory, number>>,
): KnowledgeCategory {
  let best: KnowledgeCategory = "DEV_TOOL";
  let bestScore = -Infinity;
  for (const cat of ALL_CATEGORIES) {
    const score = scores[cat] ?? 0;
    if (score > bestScore) {
      best = cat;
      bestScore = score;
    }
  }
  return best;
}

function computeConfidence(
  scores: Partial<Record<KnowledgeCategory, number>>,
  _winner: KnowledgeCategory,
): CategoryConfidence {
  const sorted = ALL_CATEGORIES.map((cat) => scores[cat] ?? 0).sort((a, b) => b - a);
  const top = sorted[0] ?? 0;
  const second = sorted[1] ?? 0;
  const margin = top - second;
  if (top >= 70 && margin >= 15) {
    return "high";
  }
  if (top >= 50 && margin >= 8) {
    return "medium";
  }
  return "low";
}

export function decideProjectCategory(input: CategorySemanticInput): CategoryDecisionResult {
  void warmOperatorLearningCache();
  const text = buildSemanticText(input);
  const aiCategory = normalizeAiCategory(input.aiSuggestedCategory);
  const scores = initScores(aiCategory);

  const voiceHits = countSignals(text, VOICE_MEDIA_SIGNALS);
  const videoHits = countSignals(text, VIDEO_SIGNALS);
  const imageHits = countSignals(text, IMAGE_SIGNALS);
  const devHits = countSignals(text, DEV_TOOL_SIGNALS);
  const writingHits = countSignals(text, WRITING_SIGNALS);
  const dataHits = countSignals(text, DATA_SIGNALS);
  const searchHits = countSignals(text, SEARCH_SIGNALS);
  const educationHits = countSignals(text, EDUCATION_SIGNALS);
  const financeHits = countSignals(text, FINANCE_SIGNALS);
  const agentStrongHits = countSignals(text, AGENT_STRONG_SIGNALS);
  const agentWeakHits = countSignals(text, AGENT_WEAK_SIGNALS);

  if (voiceHits > 0) {
    bump(scores, "AI_IMAGE", 40 + voiceHits * 8);
    bump(scores, "AI_VIDEO", voiceHits * 4);
    bump(scores, "AI_AGENT", -25);
  }
  if (videoHits > 0) {
    bump(scores, "AI_VIDEO", 30 + videoHits * 6);
  }
  if (imageHits > 0) {
    bump(scores, "AI_IMAGE", 25 + imageHits * 5);
  }
  if (devHits > 0) {
    bump(scores, "DEV_TOOL", 25 + devHits * 5);
  }
  if (writingHits > 0) {
    bump(scores, "AI_WRITING", 25 + writingHits * 5);
  }
  if (dataHits > 0) {
    bump(scores, "DATA_TOOL", 25 + dataHits * 5);
  }
  if (searchHits > 0) {
    bump(scores, "SEARCH", 25 + searchHits * 5);
  }
  if (educationHits > 0) {
    bump(scores, "EDUCATION", 25 + educationHits * 5);
  }
  if (financeHits > 0) {
    bump(scores, "FINANCE", 25 + financeHits * 5);
  }

  if (agentStrongHits >= 2) {
    bump(scores, "AI_AGENT", 35 + agentStrongHits * 10);
  } else if (agentWeakHits > 0 && agentStrongHits === 0) {
    bump(scores, "AI_AGENT", 5);
    bump(scores, "PRODUCTIVITY", 10);
  } else {
    bump(scores, "AI_AGENT", -10);
  }

  if (voiceHits > 0 && agentStrongHits < 2) {
    bump(scores, "AI_AGENT", -30);
  }

  applyOperatorLearningToCategoryScores(text, scores);

  let knowledgeCategory = pickBestCategory(scores);

  if (knowledgeCategory === "AI_AGENT" && agentStrongHits < 2) {
    if (voiceHits > 0 || imageHits > 0) {
      knowledgeCategory = voiceHits >= imageHits ? "AI_IMAGE" : "AI_IMAGE";
    } else if (devHits > 0) {
      knowledgeCategory = "DEV_TOOL";
    } else if (videoHits > 0) {
      knowledgeCategory = "AI_VIDEO";
    } else {
      knowledgeCategory = "PRODUCTIVITY";
    }
    bump(scores, "AI_AGENT", -20);
  }

  const categoryConfidence = computeConfidence(scores, knowledgeCategory);
  const needsCategoryReview = categoryConfidence === "low";
  const projectSlug = knowledgeCategoryToProjectSlug(knowledgeCategory);
  const label = getProjectCategoryLabel(projectSlug, projectSlug);

  let reason = `规则决策 → ${label} (${knowledgeCategory})`;
  if (voiceHits > 0 && knowledgeCategory === "AI_IMAGE") {
    reason = `voice/tts/clone 信号 ${voiceHits} 次，优先设计与创意工具`;
  } else if (knowledgeCategory === "AI_AGENT" && agentStrongHits >= 2) {
    reason = `检测到 ${agentStrongHits} 个智能体强信号，允许 AI智能体`;
  } else if (aiCategory === "AI_AGENT" && knowledgeCategory !== "AI_AGENT") {
    reason = `AI 建议 AI_AGENT 但缺少智能体强信号，改判为 ${label}`;
  }

  return {
    knowledgeCategory,
    projectSlug,
    categoryConfidence,
    needsCategoryReview,
    reason,
    scores,
  };
}

export function applyCategoryDecisionToKnowledge<T extends Record<string, unknown>>(
  knowledge: T,
  decision: CategoryDecisionResult,
): T & {
  primaryCategory: KnowledgeCategory;
  categoryConfidence: CategoryConfidence;
  needsCategoryReview: boolean;
  categoryDecisionReason: string;
} {
  return {
    ...knowledge,
    primaryCategory: decision.knowledgeCategory,
    categoryConfidence: decision.categoryConfidence,
    needsCategoryReview: decision.needsCategoryReview,
    categoryDecisionReason: decision.reason,
  };
}
