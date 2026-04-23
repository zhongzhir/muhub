import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { summarizeContentEdit, userOperatorLabel } from "@/lib/project-ai-content-edit-summary";
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
    return { ok: false as const, status: 403, error: "仅已认领项目方或管理员可查看改动历史。" };
  }
  return { ok: true as const, userId };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await canAccess(id);
  if (!access.ok) {
    return Response.json({ ok: false, error: access.error }, { status: access.status });
  }

  const logs = await prisma.projectContentEditLog.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      createdAt: true,
      operatorId: true,
      before: true,
      after: true,
      editKind: true,
    },
  });

  const operatorIds = [...new Set(logs.map((l) => l.operatorId))];
  const users =
    operatorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: operatorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  const items = logs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    operatorLabel: userOperatorLabel(userById.get(log.operatorId), log.operatorId),
    summary: summarizeContentEdit(log.before, log.after, log.editKind),
  }));

  return Response.json({ ok: true, items });
}
