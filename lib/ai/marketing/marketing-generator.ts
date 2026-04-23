import { getDeepSeekClient } from "@/lib/deepseek";
import { buildPrompt } from "@/lib/ai/marketing/prompts";

type MarketingMode = "social" | "article";
type MarketingTone = "balanced" | "expressive";

type MarketingSourceBasis = {
  hasOfficialInfo: boolean;
  hasAiInsight: boolean;
  usedFields: string[];
};

export type MarketingContentResult = {
  mode: MarketingMode;
  tone: MarketingTone;
  sourceBasis: MarketingSourceBasis;
  titleCandidates?: string[];
  hookLine?: string;
  content: string;
  summaryNotes: string[];
};

type MarketingAiInsight = {
  summary?: string;
  whatItIs?: string;
  whoFor?: string[] | string;
  useCases?: string[] | string;
  highlights?: string[] | string;
  valueSignals?: string[] | string;
};

type MarketingOfficialInfo = {
  summary?: string | null;
  fullDescription?: string | null;
  useCases?: string[] | null;
  whoFor?: string[] | null;
};

function listToText(value: string[] | string | null | undefined): string {
  if (Array.isArray(value)) return value.map((v) => v.trim()).filter(Boolean).join("；");
  return typeof value === "string" ? value.trim() : "";
}

function stripFence(raw: string): string {
  const t = raw.trim();
  if (!t.startsWith("```")) return t;
  return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function asStringArray(value: unknown, max = 5): string[] {
  if (!Array.isArray(value)) return [];
  const out = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return out.slice(0, max);
}

export async function generateMarketingContent({
  project,
  officialInfo,
  aiInsight,
  mode = "social",
  tone = "balanced",
  sourceBasis,
}: {
  project: {
    name: string;
    tagline?: string | null;
    description?: string | null;
    tags?: string[] | null;
    categories?: string[] | null;
    primaryCategory?: string | null;
    githubUrl?: string | null;
    websiteUrl?: string | null;
  };
  officialInfo?: MarketingOfficialInfo | null;
  aiInsight?: MarketingAiInsight | null;
  sourceBasis: MarketingSourceBasis;
  mode?: MarketingMode;
  tone?: MarketingTone;
}) {
  const client = getDeepSeekClient();
  const usedFacts = [
    project.githubUrl ? `GitHub：${project.githubUrl}` : "",
    project.websiteUrl ? `官网：${project.websiteUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const baseInfo = `
项目名称：${project.name}

官方信息（优先）：
- 官方一句话：${officialInfo?.summary ?? ""}
- 官方详细介绍：${officialInfo?.fullDescription ?? ""}
- 官方适合谁：${listToText(officialInfo?.whoFor)}
- 官方使用场景：${listToText(officialInfo?.useCases)}

AI结构化分析：
- 一句话理解：${aiInsight?.summary ?? ""}
- 项目是什么：${aiInsight?.whatItIs ?? ""}
- 适合谁：${listToText(aiInsight?.whoFor)}
- 使用场景：${listToText(aiInsight?.useCases)}
- 亮点：${listToText(aiInsight?.highlights)}
- 价值信号：${listToText(aiInsight?.valueSignals)}

项目结构字段：
- tagline：${project.tagline ?? ""}
- description：${project.description ?? ""}
- 分类：${[project.primaryCategory ?? "", ...(project.categories ?? [])].filter(Boolean).join("、")}
- 标签：${(project.tags ?? []).join("、")}

来源事实（补充）：
${usedFacts || "暂无外部来源链接"}
`;
  const prompt = buildPrompt({
    mode,
    tone,
    baseInfo,
  });

  const response = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL_CONTENT || "deepseek-chat",
    messages: [
      {
        role: "system",
        content:
          "你是一个擅长科技内容与公众号写作的作者。你可以重组表达，但严禁编造事实。必须返回合法 JSON，不要返回 markdown 代码块。",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: tone === "expressive" ? (mode === "article" ? 0.9 : 0.8) : (mode === "article" ? 0.7 : 0.6),
  });

  const text = response.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("AI 返回空内容");
  }
  const parsed = JSON.parse(stripFence(text)) as Record<string, unknown>;
  const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
  if (!content) throw new Error("AI 返回内容缺失");

  const titleCandidates = asStringArray(parsed.titleCandidates, 5);
  const summaryNotes = asStringArray(parsed.summaryNotes, 6);
  const hookLine = typeof parsed.hookLine === "string" ? parsed.hookLine.trim() : "";

  return {
    mode,
    tone,
    sourceBasis,
    content,
    titleCandidates: mode === "article" ? titleCandidates : undefined,
    hookLine: mode === "social" && hookLine ? hookLine : undefined,
    summaryNotes,
  };
}
