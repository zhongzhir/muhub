import type { Prisma } from "@prisma/client";
import { getDeepSeekClient } from "@/lib/deepseek";
import { prisma } from "@/lib/prisma";

export type ProjectAIContent = {
  version: "v1";
  sourceBasis: {
    hasOfficialInfo: boolean;
    hasAiInsight: boolean;
    sourcePriority: string[];
  };
  copy: {
    oneLiner: string;
    short: string;
    medium: string;
    long: string;
    audienceVersions: {
      general?: string;
      business?: string;
      creator?: string;
      developer?: string;
    };
  };
  poster: {
    title: string;
    subtitle: string;
    highlights: string[];
    targetUsers: string;
    callToAction: string;
    contactLine?: string;
    linkLine?: string;
  };
  notes: string[];
  validation: {
    basedOn: string[];
    weakPoints: string[];
    verifyBeforeUse: string[];
  };
  generatedAt: string;
};

export type ProjectContentSourceSnapshot = {
  projectId: string;
  name: string;
  slug: string;
  officialInfo: {
    summary: string | null;
    fullDescription: string | null;
    useCases: string[];
    whoFor: string[];
    website: string | null;
    twitter: string | null;
    discord: string | null;
    contactEmail: string | null;
  } | null;
  aiInsight: unknown;
  sourceSnapshot: unknown;
  tags: string[];
  primaryCategory: string | null;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const text = asString(item);
    if (!text) continue;
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function clamp(text: string, max: number): string {
  const val = text.trim().replace(/\s+/g, " ");
  return val.length > max ? `${val.slice(0, max - 1)}…` : val;
}

function stripFence(raw: string): string {
  const t = raw.trim();
  if (!t.startsWith("```")) return t;
  return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export async function buildProjectContentSourceSnapshot(
  projectId: string,
): Promise<ProjectContentSourceSnapshot | null> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      tags: true,
      primaryCategory: true,
      aiInsight: true,
      aiSourceSnapshot: true,
      officialInfo: {
        select: {
          summary: true,
          fullDescription: true,
          useCases: true,
          whoFor: true,
          website: true,
          twitter: true,
          discord: true,
          contactEmail: true,
        },
      },
    },
  });
  if (!row) return null;
  return {
    projectId: row.id,
    name: row.name,
    slug: row.slug,
    officialInfo: row.officialInfo
      ? {
          summary: row.officialInfo.summary,
          fullDescription: row.officialInfo.fullDescription,
          useCases: asStringArray(row.officialInfo.useCases),
          whoFor: asStringArray(row.officialInfo.whoFor),
          website: row.officialInfo.website,
          twitter: row.officialInfo.twitter,
          discord: row.officialInfo.discord,
          contactEmail: row.officialInfo.contactEmail,
        }
      : null,
    aiInsight: row.aiInsight,
    sourceSnapshot: row.aiSourceSnapshot,
    tags: row.tags,
    primaryCategory: row.primaryCategory,
  };
}

function normalizeContent(input: unknown, snapshot: ProjectContentSourceSnapshot): ProjectAIContent {
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const copy = obj.copy && typeof obj.copy === "object" ? (obj.copy as Record<string, unknown>) : {};
  const poster = obj.poster && typeof obj.poster === "object" ? (obj.poster as Record<string, unknown>) : {};
  const audience =
    copy.audienceVersions && typeof copy.audienceVersions === "object"
      ? (copy.audienceVersions as Record<string, unknown>)
      : {};

  const hasOfficialInfo = Boolean(snapshot.officialInfo);
  const hasAiInsight = Boolean(snapshot.aiInsight);
  const priority = hasOfficialInfo
    ? ["officialInfo", "aiInsight", "sourceSnapshot", "rawFields"]
    : ["aiInsight", "sourceSnapshot", "rawFields"];

  return {
    version: "v1",
    sourceBasis: {
      hasOfficialInfo,
      hasAiInsight,
      sourcePriority: priority,
    },
    copy: {
      oneLiner: clamp(asString(copy.oneLiner) || "信息不足，当前仅能给出保守传播描述。", 120),
      short: clamp(asString(copy.short) || "信息不足，建议先补充官方信息后再生成传播文案。", 220),
      medium: clamp(asString(copy.medium) || "信息不足，建议补充项目亮点、目标用户和使用场景。", 500),
      long: clamp(asString(copy.long) || "当前公开信息较少，暂无法生成完整长文案，请先补充官方介绍与使用场景。", 1200),
      audienceVersions: {
        general: clamp(asString(audience.general), 220) || undefined,
        business: clamp(asString(audience.business), 220) || undefined,
        creator: clamp(asString(audience.creator), 220) || undefined,
        developer: clamp(asString(audience.developer), 220) || undefined,
      },
    },
    poster: {
      title: clamp(asString(poster.title) || snapshot.name, 60),
      subtitle: clamp(asString(poster.subtitle) || "基于公开与官方信息整理的传播草稿", 100),
      highlights: asStringArray(poster.highlights, 5),
      targetUsers: clamp(asString(poster.targetUsers) || "信息不足，建议补充目标用户", 120),
      callToAction: clamp(asString(poster.callToAction) || "欢迎了解项目详情并联系项目方", 120),
      contactLine: clamp(asString(poster.contactLine), 120) || undefined,
      linkLine: clamp(asString(poster.linkLine), 180) || undefined,
    },
    notes: asStringArray(obj.notes, 8),
    validation: {
      basedOn: asStringArray((obj.validation as Record<string, unknown> | undefined)?.basedOn, 5),
      weakPoints: asStringArray((obj.validation as Record<string, unknown> | undefined)?.weakPoints, 8),
      verifyBeforeUse: asStringArray(
        (obj.validation as Record<string, unknown> | undefined)?.verifyBeforeUse,
        8,
      ),
    },
    generatedAt: asString(obj.generatedAt) || new Date().toISOString(),
  };
}

export async function generateProjectAIContent(
  snapshot: ProjectContentSourceSnapshot,
): Promise<ProjectAIContent> {
  const client = getDeepSeekClient();
  const model = process.env.DEEPSEEK_MODEL_CONTENT?.trim() || "deepseek-chat";
  const hasOfficial = Boolean(snapshot.officialInfo);
  const systemPrompt = [
    "你是 MUHUB 的项目传播表达助手。",
    "你的任务不是评价项目，也不是编造营销故事，而是基于已提供信息生成适合传播的中文草稿。",
    "只能依据输入内容生成，不得虚构客户、数据、合作关系、融资情况、团队背景。",
    "可以优化表达和提炼亮点，但不能超出事实边界。",
    "不得输出“行业第一”“全球领先”“大量用户”等无依据表述。",
    "如信息不足，请保守生成，并在 notes 中说明。",
    "必须输出 validation：basedOn、weakPoints、verifyBeforeUse。",
    "basedOn 应反映主要依据来源（official / ai_insight / source_snapshot / raw_fields）。",
    "weakPoints 必须指出信息不足或不确定点。",
    "verifyBeforeUse 必须给出发布前人工确认事项。",
    "输出必须为合法 json，不要输出 markdown。",
    "你必须输出 json。",
  ].join("\n");
  const prompt = [
    hasOfficial
      ? "输入中存在 officialInfo，请优先参考官方信息，再参考 aiInsight、sourceSnapshot、raw。"
      : "输入中不存在 officialInfo，请按 aiInsight、sourceSnapshot、raw 的顺序保守生成。",
    "请基于以下输入生成 ProjectAIContent JSON：",
    JSON.stringify(
      {
        version: "v1",
        sourceBasis: {
          hasOfficialInfo: true,
          hasAiInsight: true,
          sourcePriority: ["officialInfo", "aiInsight", "sourceSnapshot", "rawFields"],
        },
        copy: {
          oneLiner: "string",
          short: "string",
          medium: "string",
          long: "string",
          audienceVersions: {
            general: "string",
            business: "string",
            creator: "string",
            developer: "string",
          },
        },
        poster: {
          title: "string",
          subtitle: "string",
          highlights: ["string"],
          targetUsers: "string",
          callToAction: "string",
          contactLine: "string",
          linkLine: "string",
        },
        notes: ["string"],
        validation: {
          basedOn: ["official", "ai_insight", "source_snapshot"],
          weakPoints: ["string"],
          verifyBeforeUse: ["string"],
        },
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    `输入快照：${JSON.stringify(snapshot)}`,
  ].join("\n\n");

  let lastErr = "";
  let emptyContentAttempts = 0;
  let jsonParseFailedAttempts = 0;
  console.info("[AI][Content] start", {
    projectId: snapshot.projectId,
    model,
  });
  for (let i = 0; i < 2; i += 1) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4000,
        temperature: 0.4,
      });
      const usage = response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : null;
      const raw = response.choices?.[0]?.message?.content?.trim() ?? "";
      if (!raw) {
        emptyContentAttempts += 1;
        throw new Error("AI 返回空内容，请稍后重试");
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(stripFence(raw)) as unknown;
      } catch {
        jsonParseFailedAttempts += 1;
        throw new Error("AI 输出格式异常，请稍后重试");
      }
      const normalized = normalizeContent(parsed, snapshot);
      if (!normalized.poster.highlights.length) {
        normalized.poster.highlights = ["基于现有信息整理，建议补充更多官方资料后再发布"];
      }
      if (!normalized.notes.length) {
        normalized.notes = ["AI生成传播草稿，请在发布前确认内容与项目实际一致。"];
      }
      if (!normalized.validation.basedOn.length) {
        normalized.validation.basedOn = normalized.sourceBasis.hasOfficialInfo
          ? ["official", "ai_insight"]
          : normalized.sourceBasis.hasAiInsight
            ? ["ai_insight", "source_snapshot"]
            : ["raw_fields"];
      }
      if (!normalized.validation.weakPoints.length) {
        normalized.validation.weakPoints = ["当前输入信息有限，部分传播表达需人工补充细节。"];
      }
      if (!normalized.validation.verifyBeforeUse.length) {
        normalized.validation.verifyBeforeUse = [
          "请确认亮点描述与官方信息一致。",
          "请确认对外联系方式和链接可用。",
        ];
      }
      console.info("[AI][Content] success", {
        projectId: snapshot.projectId,
        model,
        usage,
      });
      return normalized;
    } catch (error) {
      lastErr = error instanceof Error ? error.message : "AI Content 生成失败";
    }
  }
  console.error("[AI][Content] failed", {
    projectId: snapshot.projectId,
    model,
    emptyContentAttempts,
    jsonParseFailedAttempts,
    error: lastErr,
  });
  throw new Error(lastErr || "AI Content 生成失败");
}

export async function saveProjectAIContent(
  projectId: string,
  payload: { content: ProjectAIContent },
) {
  return prisma.project.update({
    where: { id: projectId },
    data: {
      aiContent: payload.content as unknown as Prisma.InputJsonValue,
      aiContentStatus: "success",
      aiContentUpdatedAt: new Date(),
      aiContentError: null,
    },
    select: {
      id: true,
      aiContentUpdatedAt: true,
    },
  });
}
