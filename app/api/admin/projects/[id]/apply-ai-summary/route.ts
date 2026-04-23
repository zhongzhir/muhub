import { revalidatePath } from "next/cache";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { normalizeChineseExpression } from "@/lib/zh-normalization";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function pickInsightSummary(aiInsight: unknown): string {
  const obj = aiInsight && typeof aiInsight === "object" ? (aiInsight as Record<string, unknown>) : {};
  const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";
  return normalizeChineseExpression(summary);
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let admin: { userId: string; email?: string | null };
  try {
    admin = await requireMuHubAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return Response.json({ ok: false, error: error.message }, { status: error.code === "UNAUTHORIZED" ? 401 : 403 });
    }
    throw error;
  }

  const { id } = await ctx.params;
  const row = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, slug: true, tagline: true, aiInsight: true },
  });
  if (!row) return Response.json({ ok: false, error: "项目不存在或已删除。" }, { status: 404 });

  const nextTagline = pickInsightSummary(row.aiInsight);
  if (!nextTagline) {
    return Response.json({ ok: false, error: "AI 认知卡中暂无可应用的一句话介绍。" }, { status: 400 });
  }

  await prisma.project.update({
    where: { id: row.id },
    data: { tagline: nextTagline },
  });
  await prisma.projectAiOpsLog.create({
    data: {
      projectId: row.id,
      operatorId: admin.userId,
      operatorEmail: admin.email ?? null,
      action: "apply_ai_summary",
      mode: "replace",
      before: { tagline: row.tagline ?? "" },
      after: { tagline: nextTagline },
      appliedItems: { from: "aiInsight.summary" },
    },
  });

  revalidatePath(`/admin/projects/${row.id}/edit`);
  revalidatePath(`/projects/${row.slug}`);
  return Response.json({ ok: true, projectId: row.id, tagline: nextTagline });
}
