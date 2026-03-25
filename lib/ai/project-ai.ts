/**
 * 最小 OpenAI Chat Completions 封装（无 Agent / 无队列）。
 * 未配置 OPENAI_API_KEY 时所有 generate* 返回 null，调用方自行降级。
 */

const DEFAULT_MODEL = "gpt-4o-mini";

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function openAiBaseUrl(): string {
  const u = process.env.OPENAI_BASE_URL?.trim();
  return u || "https://api.openai.com";
}

function openAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

type ChatMessage = { role: "system" | "user"; content: string };

async function chatCompletion(messages: ChatMessage[], maxTokens: number): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return null;
  }
  const url = `${openAiBaseUrl().replace(/\/$/, "")}/v1/chat/completions`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: openAiModel(),
        temperature: 0.35,
        max_tokens: maxTokens,
        messages,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn("[project-ai] OpenAI HTTP", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (e) {
    console.warn("[project-ai] fetch failed", e);
    return null;
  }
}

function normalizeDescription(raw: string | null): string | null {
  if (!raw) return null;
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4);
  const joined = lines.join("\n");
  if (joined.length > 450) {
    return joined.slice(0, 447).trimEnd() + "…";
  }
  return joined || null;
}

export type ProjectDescriptionInput = {
  name: string;
  tagline?: string | null;
  githubUrl?: string | null;
};

/** 1–3 行中文简介：是什么、用途、技术领域 */
export async function generateProjectDescription(input: ProjectDescriptionInput): Promise<string | null> {
  const userBits = [
    `项目名称：${input.name}`,
    input.tagline?.trim() ? `一句话：${input.tagline.trim()}` : null,
    input.githubUrl?.trim() ? `仓库地址：${input.githubUrl.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const text = await chatCompletion(
    [
      {
        role: "system",
        content:
          "你是开源项目简介编辑。根据给定信息写出简体中文介绍，严格 1～3 行（每行一句），不超过 220 字。依次说明：项目是什么、主要用途、技术或领域。不要 Markdown、不要列表符号、不要客套话。若信息不足，合理推断但勿编造具体公司或数据。",
      },
      { role: "user", content: userBits },
    ],
    220,
  );
  return normalizeDescription(text);
}

export type ProjectTagsInput = {
  name: string;
  tagline?: string | null;
  githubUrl?: string | null;
};

function parseJsonArray(raw: string): string[] | null {
  const t = raw.trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  try {
    const arr = JSON.parse(t.slice(start, end + 1)) as unknown;
    if (!Array.isArray(arr)) return null;
    const tags = arr
      .map((x) => (typeof x === "string" ? x.trim() : String(x)))
      .map((x) => x.replace(/\s+/g, ""))
      .filter(Boolean);
    const unique = [...new Set(tags)];
    return unique.slice(0, 5);
  } catch {
    return null;
  }
}

/** 3–5 个技术向短标签（可中英混合） */
export async function generateProjectTags(input: ProjectTagsInput): Promise<string[] | null> {
  const userBits = [
    `项目名称：${input.name}`,
    input.tagline?.trim() ? `一句话：${input.tagline.trim()}` : null,
    input.githubUrl?.trim() ? `仓库：${input.githubUrl.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const text = await chatCompletion(
    [
      {
        role: "system",
        content:
          "你是技术分类助手。只输出一个 JSON 数组字符串，元素 3～5 个，为简短技术标签（可英文或中文，如 LLM、Agent、Python）。不要解释、不要 Markdown、不要换行括号外文字。",
      },
      { role: "user", content: userBits },
    ],
    120,
  );
  if (!text) return null;
  const arr = parseJsonArray(text);
  if (!arr || arr.length === 0) return null;
  return arr.slice(0, 5);
}

export type UpdateSummaryInput = {
  sourceTypeLabel: string;
  title: string;
  content: string;
  sourceUrl?: string | null;
};

export type UpdateSummaryResult = {
  summary: string;
  /** 仅写入 metaJson，不覆盖 DB title */
  suggestedTitle?: string;
};

/** 基于原文生成短摘要；标题建议可选 */
export async function generateUpdateSummary(input: UpdateSummaryInput): Promise<UpdateSummaryResult | null> {
  const urlLine = input.sourceUrl?.trim() ? `链接：${input.sourceUrl.trim()}` : null;
  const body = [
    `来源类型：${input.sourceTypeLabel}`,
    `标题：${input.title}`,
    `正文：\n${input.content.slice(0, 6000)}`,
    urlLine,
  ]
    .filter(Boolean)
    .join("\n");

  const text = await chatCompletion(
    [
      {
        role: "system",
        content:
          "你是中文技术编辑。根据仓库动态或官方动态内容写「AI 摘要」：1～2 句简体中文，≤120 字，忠实原文不臆造。若第二行需要「建议标题」且与原标题差异明显，在摘要后空一行输出一行 JSON（仅此一行对象）：{\"suggestedTitle\":\"...\"}；否则不要输出 JSON。",
      },
      { role: "user", content: body },
    ],
    200,
  );
  if (!text) return null;

  const jsonMatch = text.match(/\{[\s\S]*"suggestedTitle"[\s\S]*\}/);
  let suggestedTitle: string | undefined;
  let summaryText = text;
  if (jsonMatch) {
    try {
      const o = JSON.parse(jsonMatch[0]) as { suggestedTitle?: string };
      if (typeof o.suggestedTitle === "string" && o.suggestedTitle.trim()) {
        suggestedTitle = o.suggestedTitle.trim().slice(0, 200);
      }
      summaryText = text.slice(0, jsonMatch.index).trim();
    } catch {
      summaryText = text.split("\n")[0]?.trim() || text.trim();
    }
  }

  const summary = summaryText.replace(/^AI 摘要[：:]\s*/i, "").trim();
  if (!summary) return null;
  return {
    summary: summary.slice(0, 400),
    suggestedTitle,
  };
}
