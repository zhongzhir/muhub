/**
 * 多源 ProjectUpdate 周窗口聚合 → AI Weekly Summary → 写入 ProjectWeeklySummary
 */

import { generateProjectWeeklySummaryAi, isAiConfigured } from "@/lib/ai/project-ai";
import { prisma } from "@/lib/prisma";
import { updateSourceTypeLabel } from "@/lib/update-source";

export type GenerateProjectWeeklySummaryResult =
  | { ok: true; id: string; updateCount: number }
  | { ok: false; reason: string };

const UPDATE_SELECT = {
  id: true,
  sourceType: true,
  sourceLabel: true,
  title: true,
  summary: true,
  content: true,
  sourceUrl: true,
  occurredAt: true,
  createdAt: true,
} as const;

function effectiveAt(u: { occurredAt: Date | null; createdAt: Date }): Date {
  return u.occurredAt ?? u.createdAt;
}

function formatRangeZh(startAt: Date, endAt: Date): string {
  const opt: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai",
  };
  return `${startAt.toLocaleString("zh-CN", opt)} — ${endAt.toLocaleString("zh-CN", opt)}`;
}

/**
 * 以当前时间为窗口终点，回溯 7 天内的动态，调用 AI 生成周总结并落库。
 */
export async function generateProjectWeeklySummary(
  projectId: string,
): Promise<GenerateProjectWeeklySummaryResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, reason: "database_not_configured" };
  }
  if (!isAiConfigured()) {
    return { ok: false, reason: "openai_not_configured" };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });
  if (!project) {
    return { ok: false, reason: "project_not_found" };
  }

  const endAt = new Date();
  const startAt = new Date(endAt.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recent = await prisma.projectUpdate.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: UPDATE_SELECT,
  });

  const inWindow = recent.filter((u) => {
    const t = effectiveAt(u).getTime();
    return t >= startAt.getTime() && t <= endAt.getTime();
  });

  if (inWindow.length === 0) {
    return { ok: false, reason: "no_updates_in_window" };
  }

  const lines = inWindow
    .sort((a, b) => effectiveAt(b).getTime() - effectiveAt(a).getTime())
    .map((u, i) => {
      const st = updateSourceTypeLabel(u.sourceType);
      const label = u.sourceLabel?.trim() || st;
      const sum = u.summary?.trim() || u.content?.trim() || "";
      const excerpt = sum ? sum.slice(0, 400) : "";
      const url = u.sourceUrl?.trim() ? ` ${u.sourceUrl.trim()}` : "";
      return `${i + 1}. [${label}] ${u.title}${excerpt ? ` — ${excerpt}` : ""}${url}`;
    })
    .join("\n");

  const rangeLabel = formatRangeZh(startAt, endAt);
  const summaryText = await generateProjectWeeklySummaryAi({
    projectName: project.name,
    rangeLabel,
    feed: lines,
  });
  if (!summaryText?.trim()) {
    return { ok: false, reason: "ai_empty_or_failed" };
  }

  const row = await prisma.projectWeeklySummary.create({
    data: {
      projectId,
      summary: summaryText.trim(),
      startAt,
      endAt,
    },
    select: { id: true },
  });

  return { ok: true, id: row.id, updateCount: inWindow.length };
}
