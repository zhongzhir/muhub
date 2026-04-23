import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { isAiContentDraftWorkflowStatus } from "@/lib/project-ai-content-edit-summary";
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
    return { ok: false as const, status: 403, error: "仅已认领项目方或管理员可更新草稿状态。" };
  }
  return { ok: true as const, userId };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await canAccess(id);
  if (!access.ok) {
    return Response.json({ ok: false, error: access.error }, { status: access.status });
  }

  const body = (await req.json().catch(() => ({}))) as { status?: string };
  const status = body.status;
  if (!status || !isAiContentDraftWorkflowStatus(status)) {
    return Response.json({ ok: false, error: "状态值无效。" }, { status: 400 });
  }

  const updatedAt = new Date();
  const row = await prisma.project.updateMany({
    where: { id, deletedAt: null },
    data: {
      aiContentDraftStatus: status,
      aiContentDraftStatusUpdatedAt: updatedAt,
    },
  });
  if (!row.count) {
    return Response.json({ ok: false, error: "项目不存在或已删除。" }, { status: 404 });
  }

  return Response.json({
    ok: true,
    status,
    updatedAt: updatedAt.toISOString(),
  });
}
