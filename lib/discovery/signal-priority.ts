import type { DiscoverySourceType } from "@prisma/client";
import { normalizeReferenceSources } from "@/lib/discovery/reference-sources";
import { getDiscoverySignalSourceStats } from "@/lib/discovery/signal-source-stats";

export type DiscoverySignalPriority = "HIGH" | "MEDIUM" | "LOW";

type SignalPriorityInput = {
  sourceType: DiscoverySourceType;
  title?: string | null;
  summary?: string | null;
  guessedProjectName?: string | null;
  guessedWebsiteUrl?: string | null;
  guessedGithubUrl?: string | null;
  referenceSources?: unknown;
};

const PRODUCT_HINT_WORDS = [
  "发布",
  "上线",
  "开源",
  "融资",
  "产品",
  "工具",
  "平台",
  "agent",
  "saas",
  "app",
  "launch",
  "open source",
  "raises",
];

const GENERIC_WORDS = [
  "行业",
  "趋势",
  "观察",
  "解读",
  "评论",
  "观点",
  "weekly",
  "newsletter",
];

function hasProjectLikeTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return false;
  if (/^[A-Z][A-Za-z0-9_\-]{1,30}(\s|:|：|-)/.test(t)) return true;
  if (/(发布|上线|开源|完成融资|获投)/.test(t)) return true;
  return false;
}

export function scoreDiscoverySignal(input: SignalPriorityInput): {
  score: number;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];
  const summaryText = `${input.title ?? ""} ${input.summary ?? ""}`.toLowerCase();
  const refs = normalizeReferenceSources(input.referenceSources);
  const sourceStats = getDiscoverySignalSourceStats(input.referenceSources);

  if (input.guessedGithubUrl) {
    score += 3;
    reasons.push("检测到 GitHub 链接");
  }
  if (input.guessedWebsiteUrl) {
    score += 2;
    reasons.push("检测到官网链接");
  }
  if ((input.guessedProjectName ?? "").trim()) {
    score += 2;
    reasons.push("已推断项目名称");
  }
  if (input.title && hasProjectLikeTitle(input.title)) {
    score += 2;
    reasons.push("标题具有项目发布特征");
  }
  if (refs.length > 0) {
    score += 1;
    reasons.push("存在参考资料");
  }
  if (sourceStats.total >= 3) {
    score += 2;
    reasons.push("多来源提及（3+）");
  } else if (sourceStats.total >= 2) {
    score += 1;
    reasons.push("多来源提及（2）");
  }

  if (input.sourceType === "NEWS") {
    score += 2;
    reasons.push("来源可信度较高（NEWS）");
  } else if (input.sourceType === "BLOG") {
    score += 1;
    reasons.push("来源可信度中等（BLOG）");
  }

  if (PRODUCT_HINT_WORDS.some((word) => summaryText.includes(word))) {
    score += 1;
    reasons.push("摘要包含项目/产品信号词");
  }
  if (GENERIC_WORDS.some((word) => summaryText.includes(word))) {
    score -= 2;
    reasons.push("内容偏行业泛信息");
  }
  if (!input.guessedGithubUrl && !input.guessedWebsiteUrl && refs.length === 0) {
    score -= 2;
    reasons.push("缺少外链与推断信息");
  }

  return { score, reasons };
}

export function getDiscoverySignalPriority(input: SignalPriorityInput): {
  priority: DiscoverySignalPriority;
  score: number;
  note: string;
} {
  const { score, reasons } = scoreDiscoverySignal(input);
  const priority: DiscoverySignalPriority = score >= 6 ? "HIGH" : score >= 3 ? "MEDIUM" : "LOW";
  const note = reasons.slice(0, 2).join("；") || "线索信息较少，建议补充后判断";
  return { priority, score, note };
}
