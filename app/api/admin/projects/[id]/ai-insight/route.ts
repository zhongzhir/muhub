import { revalidatePath } from "next/cache";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { generateAndSaveProjectAiInsight } from "@/lib/project-ai-insight-service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatAdminError(error: unknown) {
  if (error instanceof AdminAuthError) {
    return Response.json(
      { ok: false, error: error.message },
      { status: error.code === "UNAUTHORIZED" ? 401 : 403 },
    );
  }
  throw error;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireMuHubAdmin();
  } catch (error) {
    return formatAdminError(error);
  }
  const { id } = await ctx.params;
  const row = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      aiInsight: true,
      aiInsightStatus: true,
      aiInsightUpdatedAt: true,
      aiInsightError: true,
      aiSignals: true,
      aiSuggestedTags: true,
      aiSuggestedCategories: true,
      aiCompleteness: true,
      aiSourceSnapshot: true,
      aiSourceLevel: true,
    },
  });
  if (!row) {
    return Response.json({ ok: false, error: "项目不存在或已删除。" }, { status: 404 });
  }
  return Response.json({
    ok: true,
    projectId: row.id,
    status: row.aiInsightStatus ?? "idle",
    insight: row.aiInsight,
    completeness: row.aiCompleteness,
    signals: row.aiSignals,
    suggestedTags: row.aiSuggestedTags,
    suggestedCategories: row.aiSuggestedCategories,
    sourceSnapshot: row.aiSourceSnapshot,
    sourceLevel: row.aiSourceLevel ?? null,
    updatedAt: row.aiInsightUpdatedAt?.toISOString() ?? null,
    error: row.aiInsightError ?? null,
  });
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireMuHubAdmin();
  } catch (error) {
    return formatAdminError(error);
  }
  const { id } = await ctx.params;
  const existing = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!existing) {
    return Response.json({ ok: false, error: "项目不存在或已删除。" }, { status: 404 });
  }

  try {
    const generated = await generateAndSaveProjectAiInsight(existing.id, {
      reason: "admin_edit_ai_insight",
    });
    revalidatePath(`/admin/projects/${existing.id}/edit`);
    revalidatePath(`/projects/${existing.slug}`);
    return Response.json({
      ok: true,
      projectId: existing.id,
      status: "success",
      insight: generated.insight,
      completeness: generated.completeness,
      signals: generated.signals,
      suggestedTags: generated.suggestedTags,
      suggestedCategories: generated.suggestedCategories,
      sourceSnapshot: generated.sourceSnapshot,
      sourceLevel: generated.sourceLevel,
      updatedAt: generated.updatedAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 认知卡生成失败，请稍后重试。";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
