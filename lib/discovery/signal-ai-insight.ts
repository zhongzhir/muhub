import { AiConfigError, AiGenerateError, generateText } from "@/lib/ai/generate-text";

export type SignalAiInsight = {
  likelyProject: "HIGH" | "MEDIUM" | "LOW";
  suggestedName?: string;
  suggestedSummary?: string;
  suggestedCategory?: string;
  recommendation?: string;
  reasons: string[];
};

type SignalAiInsightInput = {
  title: string;
  summary?: string | null;
  rawText?: string | null;
  sourceType: string;
  sourceName: string;
  url: string;
  referenceSources: unknown;
  guessedProjectName?: string | null;
  guessedWebsiteUrl?: string | null;
  guessedGithubUrl?: string | null;
  priority: "HIGH" | "MEDIUM" | "LOW";
  priorityNote: string;
  sourceStatsText: string;
  sourceStatsTotal: number;
};

function cleanOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseInsightFromText(text: string): SignalAiInsight | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match?.[0]) {
    return null;
  }
  try {
    const raw = JSON.parse(match[0]) as Record<string, unknown>;
    const likelyProjectRaw = typeof raw.likelyProject === "string" ? raw.likelyProject.toUpperCase() : "";
    const likelyProject =
      likelyProjectRaw === "HIGH" || likelyProjectRaw === "MEDIUM" || likelyProjectRaw === "LOW"
        ? likelyProjectRaw
        : null;
    const reasonsRaw = Array.isArray(raw.reasons) ? raw.reasons : [];
    const reasons = reasonsRaw
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .slice(0, 6);
    if (!likelyProject || reasons.length === 0) {
      return null;
    }
    return {
      likelyProject,
      suggestedName: cleanOptionalText(raw.suggestedName),
      suggestedSummary: cleanOptionalText(raw.suggestedSummary),
      suggestedCategory: cleanOptionalText(raw.suggestedCategory),
      recommendation: cleanOptionalText(raw.recommendation),
      reasons,
    };
  } catch {
    return null;
  }
}

export async function generateSignalAiInsight(
  input: SignalAiInsightInput,
): Promise<{ ok: true; insight: SignalAiInsight } | { ok: false; error: string }> {
  const prompt = [
    "请根据以下 signal 信息做“运营辅助分析”，并只输出 JSON 对象，不要输出其它文本。",
    "JSON 结构必须为：",
    `{
  "likelyProject": "HIGH|MEDIUM|LOW",
  "suggestedName": "可选，项目建议名",
  "suggestedSummary": "可选，1-2句通俗说明，尽量<=80字",
  "suggestedCategory": "可选，建议分类，如AI助手/开发工具/数据工具",
  "recommendation": "可选，建议动作，如建议转Candidate/先补充信息/暂缓",
  "reasons": ["原因1","原因2","原因3"]
}`,
    "要求：中文为主，简洁，不要虚构；如果信息不足可降低 likelyProject。",
    "Signal 数据如下：",
    JSON.stringify(input, null, 2),
  ].join("\n\n");

  try {
    const output = await generateText(prompt, {
      temperature: 0.2,
      maxTokens: 520,
      systemPrompt:
        "你是项目线索评估助手。只返回合法 JSON，不返回 Markdown，不返回额外解释，不执行任何状态变更建议以外动作。",
    });
    const parsed = parseInsightFromText(output);
    if (!parsed) {
      return { ok: false, error: "AI 返回格式不可解析，请重试。" };
    }
    return { ok: true, insight: parsed };
  } catch (error) {
    if (error instanceof AiConfigError) {
      return { ok: false, error: "AI 未配置：请设置 AI_PROVIDER、AI_MODEL、AI_API_KEY。" };
    }
    if (error instanceof AiGenerateError) {
      return { ok: false, error: `AI 生成失败：${error.message}` };
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
