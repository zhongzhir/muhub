import { getDeepSeekClient } from "@/lib/deepseek";
import { buildPrompt } from "@/lib/ai/marketing/prompts";

type MarketingMode = "social" | "article";

export async function generateMarketingContent({
  project,
  aiInsight,
  mode = "social",
}: {
  project: {
    name: string;
    tagline?: string | null;
    description?: string | null;
    tags?: string[] | null;
  };
  aiInsight?: unknown;
  mode?: MarketingMode;
}) {
  const client = getDeepSeekClient();
  const prompt = buildPrompt({
    project,
    aiInsight: (aiInsight ?? null) as {
      whatItIs?: string;
      whoFor?: string[] | string;
      useCases?: string[] | string;
      highlights?: string[] | string;
    } | null,
    mode,
  });

  const response = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL_CONTENT || "deepseek-chat",
    messages: [
      {
        role: "system",
        content:
          "你是一个擅长写科技内容和公众号文章的作者。你可以重组表达，但严禁编造任何输入中不存在的事实。",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: mode === "article" ? 0.8 : 0.7,
  });

  const text = response.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("AI 返回空内容");
  }
  return text.trim();
}
