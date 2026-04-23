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
    return { ok: false as const, status: 403, error: "仅已认领项目方或管理员可编辑草稿。" };
  }
  return { ok: true as const, userId };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const access = await canAccess(id);
  if (!access.ok) {
    return Response.json({ ok: false, error: access.error }, { status: access.status });
  }

  const body = (await req.json().catch(() => ({}))) as { draft?: unknown };
  const draft = body.draft;
  if (!draft || typeof draft !== "object") {
    return Response.json({ ok: false, error: "草稿内容格式不正确。" }, { status: 400 });
  }

  const beforeRow = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: { aiContentDraft: true, aiContentDraftStatus: true },
  });
  if (!beforeRow) {
    return Response.json({ ok: false, error: "项目不存在或已删除。" }, { status: 404 });
  }

  const updatedAt = new Date();
  const operator = await prisma.user.findFirst({
    where: { id: access.userId },
    select: { name: true, email: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id },
      data: {
        aiContentDraft: draft as never,
        aiContentDraftUpdatedAt: updatedAt,
        aiContentDraftBy: access.userId,
        ...(!beforeRow.aiContentDraftStatus
          ? {
              aiContentDraftStatus: "drafting",
              aiContentDraftStatusUpdatedAt: updatedAt,
            }
          : {}),
      },
    });
    await tx.projectContentEditLog.create({
      data: {
        projectId: id,
        operatorId: access.userId,
        before: (beforeRow.aiContentDraft ?? {}) as never,
        after: draft as never,
        editKind: "save",
      },
    });
    const staleLogs = await tx.projectContentEditLog.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      skip: 5,
      select: { id: true },
    });
    if (staleLogs.length) {
      await tx.projectContentEditLog.deleteMany({
        where: { id: { in: staleLogs.map((item) => item.id) } },
      });
    }
  });

  const fresh = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: { aiContentDraftStatus: true, aiContentDraftStatusUpdatedAt: true },
  });

  return Response.json({
    ok: true,
    updatedAt: updatedAt.toISOString(),
    draftOperatorLabel: userOperatorLabel(operator, access.userId),
    draftWorkflowStatus: fresh?.aiContentDraftStatus ?? null,
    draftWorkflowStatusUpdatedAt: fresh?.aiContentDraftStatusUpdatedAt?.toISOString() ?? null,
  });
}
