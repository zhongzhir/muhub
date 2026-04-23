import { revalidatePath } from "next/cache";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import {
  buildProjectInsightSourceSnapshot,
  computeProjectCompleteness,
  computeProjectSourceLevel,
  generateProjectAIInsight,
  saveProjectAIInsight,
  type ProjectAISignals,
} from "@/lib/project-ai-insight";
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

  await prisma.project.update({
    where: { id: existing.id },
    data: { aiInsightStatus: "pending", aiInsightError: null },
  });

  try {
    const snapshot = await buildProjectInsightSourceSnapshot(existing.id);
    if (!snapshot) {
      return Response.json({ ok: false, error: "项目不存在或已删除。" }, { status: 404 });
    }
    const completeness = computeProjectCompleteness(snapshot);
    const sourceLevel = computeProjectSourceLevel(snapshot);
    const generated = await generateProjectAIInsight(snapshot, completeness);
    const signals: ProjectAISignals = {
      github: {
        ...snapshot.github.facts,
        isActive: snapshot.github.facts?.isActive,
        hasReleases: snapshot.github.facts?.hasReleases,
        readmeLength: snapshot.github.facts?.readmeLength,
      },
      website: snapshot.website.facts,
      socials: snapshot.socials.accounts,
      docs: {
        hasDocs: snapshot.website.hasDocs,
        hasDemo: snapshot.website.hasDemo,
        hasPricing: snapshot.website.hasPricing,
        hasContact: snapshot.website.hasContact,
      },
      media: {
        mentions: snapshot.base.recentActivities
          .slice(0, 6)
          .map((item) => item.title)
          .filter(Boolean),
      },
    };
    const updated = await saveProjectAIInsight(existing.id, {
      insight: generated.insight,
      completeness,
      signals,
      suggestedTags: generated.suggestedTags,
      suggestedCategories: generated.suggestedCategories,
      sourceSnapshot: snapshot,
      sourceLevel,
    });
    revalidatePath(`/admin/projects/${existing.id}/edit`);
    revalidatePath(`/projects/${existing.slug}`);
    return Response.json({
      ok: true,
      projectId: existing.id,
      status: "success",
      insight: generated.insight,
      completeness,
      signals,
      suggestedTags: generated.suggestedTags,
      suggestedCategories: generated.suggestedCategories,
      sourceSnapshot: snapshot,
      sourceLevel,
      updatedAt: updated.aiInsightUpdatedAt?.toISOString() ?? new Date().toISOString(),
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "AI 认知卡生成失败，请稍后重试。";
    const message =
      raw === "Missing DEEPSEEK_API_KEY"
        ? "AI 服务未配置，请检查服务器环境变量"
        : raw;
    await prisma.project.update({
      where: { id: existing.id },
      data: {
        aiInsightStatus: "failed",
        aiInsightError: message.slice(0, 300),
      },
    });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
