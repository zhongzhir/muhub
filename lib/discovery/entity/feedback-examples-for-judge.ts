/**
 * E1.6 — 为 AI Entity Judge 注入少量历史反馈样例（无 embedding / retrieval）
 */

import { prisma } from "@/lib/prisma";
import { parseFeedbackTags } from "@/lib/discovery/entity/feedback-types";

const DEFAULT_EXAMPLE_LIMIT = 6;

export async function loadFeedbackExamplesForJudgePrompt(
  limit = DEFAULT_EXAMPLE_LIMIT,
): Promise<string> {
  const perAction = Math.max(1, Math.ceil(limit / 3));

  const [accepts, rejects, unsures] = await Promise.all([
    prisma.entityHintFeedback.findMany({
      where: { action: "ACCEPT" },
      orderBy: { createdAt: "desc" },
      take: perAction,
      include: {
        entityHint: {
          select: {
            name: true,
            entityType: true,
            sourceTitle: true,
            sourceTextSnippet: true,
          },
        },
      },
    }),
    prisma.entityHintFeedback.findMany({
      where: { action: "REJECT" },
      orderBy: { createdAt: "desc" },
      take: perAction,
      include: {
        entityHint: {
          select: {
            name: true,
            entityType: true,
            sourceTitle: true,
            sourceTextSnippet: true,
          },
        },
      },
    }),
    prisma.entityHintFeedback.findMany({
      where: { action: "UNSURE" },
      orderBy: { createdAt: "desc" },
      take: Math.max(1, limit - perAction * 2),
      include: {
        entityHint: {
          select: {
            name: true,
            entityType: true,
            sourceTitle: true,
            sourceTextSnippet: true,
          },
        },
      },
    }),
  ]);

  const rows = [...accepts, ...rejects, ...unsures].slice(0, limit);
  if (rows.length === 0) {
    return "";
  }

  const lines = rows.map((row) => {
    const hint = row.entityHint;
    const tags = parseFeedbackTags(row.feedbackTags);
    const parts = [
      `- action=${row.action}`,
      `entity="${hint.name}"`,
      `type=${hint.entityType}`,
      `signal="${(hint.sourceTitle ?? "").slice(0, 60)}"`,
      tags.length ? `tags=[${tags.join(",")}]` : null,
      row.feedbackReason ? `reason=${row.feedbackReason.slice(0, 120)}` : null,
      row.notes ? `notes=${row.notes.slice(0, 80)}` : null,
    ].filter(Boolean);
    return parts.join(" | ");
  });

  return `## 专家历史反馈样例（请对齐类似判断，非硬规则）
${lines.join("\n")}`;
}
