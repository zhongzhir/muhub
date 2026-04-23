import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { userOperatorLabel } from "@/lib/project-ai-content-edit-summary";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function canAccess(projectId: string) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return { ok: false as const, status: 401, error: "请先登录。" };
  try {
    await requireMuHubAdmin();
    return { ok: true as const, userId };
  } catch (error) {
    if (!(error instanceof AdminAuthError)) throw error;
  }
  const row = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { claimedByUserId: true },
  });
  if (!row) return { ok: false as const, status: 404, error: "项目不存在或已删除。" };
  if (row.claimedByUserId !== userId) {
    return { ok: false as const, status: 403, error: "仅已认领项目方或管理员可重置草稿。" };
  }
  return { ok: true as const, userId };
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const access = await canAccess(id);
  if (!access.ok) {
    return Response.json({ ok: false, error: access.error }, { status: access.status });
  }

  const row = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: { aiContent: true, aiContentDraft: true },
  });
  if (!row) return Response.json({ ok: false, error: "项目不存在或已删除。" }, { status: 404 });
  if (!row.aiContent) return Response.json({ ok: false, error: "暂无 AI 原始内容可恢复。" }, { status: 400 });

  const updatedAt = new Date();
  const operator = await prisma.user.findFirst({
    where: { id: access.userId },
    select: { name: true, email: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id },
      data: {
        aiContentDraft: row.aiContent as never,
        aiContentDraftUpdatedAt: updatedAt,
        aiContentDraftBy: access.userId,
      },
    });
    await tx.projectContentEditLog.create({
      data: {
        projectId: id,
        operatorId: access.userId,
        before: (row.aiContentDraft ?? {}) as never,
        after: row.aiContent as never,
        editKind: "reset",
      },
    });
  });
  return Response.json({
    ok: true,
    updatedAt: updatedAt.toISOString(),
    draft: row.aiContent,
    draftOperatorLabel: userOperatorLabel(operator, access.userId),
  });
}
