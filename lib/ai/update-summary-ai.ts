import type { Prisma, ProjectUpdateSourceType } from "@prisma/client";
import { generateUpdateSummary, isAiConfigured } from "@/lib/ai/project-ai";
import { prisma } from "@/lib/prisma";
import { updateSourceTypeLabel } from "@/lib/update-source";

/** 为仓库 / 官方动态生成 summary，并标记 isAiGenerated（不修改 title/content/sourceType） */
export async function applyAiSummaryToProjectUpdate(updateId: string): Promise<void> {
  if (!process.env.DATABASE_URL?.trim() || !isAiConfigured()) {
    return;
  }

  const row = await prisma.projectUpdate.findUnique({
    where: { id: updateId },
    select: {
      id: true,
      sourceType: true,
      title: true,
      summary: true,
      content: true,
      sourceUrl: true,
      metaJson: true,
    },
  });
  if (!row) {
    return;
  }

  if (row.sourceType !== "GITHUB" && row.sourceType !== "OFFICIAL") {
    return;
  }

  if (row.summary?.trim()) {
    return;
  }

  const body = row.content?.trim() || row.title?.trim();
  if (!body) {
    return;
  }

  const sourceTypeLabel = updateSourceTypeLabel(row.sourceType as ProjectUpdateSourceType);
  const result = await generateUpdateSummary({
    sourceTypeLabel,
    title: row.title,
    content: row.content?.trim() || row.title,
    sourceUrl: row.sourceUrl,
  });
  if (!result?.summary?.trim()) {
    return;
  }

  const data: Prisma.ProjectUpdateUpdateInput = {
    summary: result.summary.trim(),
    isAiGenerated: true,
  };

  if (result.suggestedTitle && result.suggestedTitle !== row.title) {
    let metaObj: Record<string, unknown> = {};
    if (row.metaJson?.trim()) {
      try {
        const parsed = JSON.parse(row.metaJson) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          metaObj = { ...(parsed as Record<string, unknown>) };
        }
      } catch {
        /* 保留空对象，仅写入 aiSuggestedTitle */
      }
    }
    metaObj.aiSuggestedTitle = result.suggestedTitle;
    data.metaJson = JSON.stringify(metaObj);
  }

  try {
    await prisma.projectUpdate.update({
      where: { id: row.id },
      data,
    });
  } catch (e) {
    console.error("[applyAiSummaryToProjectUpdate]", e);
  }
}

export function scheduleAiSummaryForUpdate(updateId: string): void {
  void applyAiSummaryToProjectUpdate(updateId).catch((e) =>
    console.error("[scheduleAiSummaryForUpdate]", e),
  );
}
