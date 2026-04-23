import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: "请先登录后再提交认领。" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;

  const project = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, claimStatus: true, claimedByUserId: true },
  });
  if (!project) {
    return Response.json({ ok: false, error: "项目不存在或已删除。" }, { status: 404 });
  }
  if (project.claimStatus === "CLAIMED" || project.claimedByUserId) {
    return Response.json({ ok: false, error: "该项目已被认领。" }, { status: 400 });
  }

  const pending = await prisma.projectClaim.findFirst({
    where: { projectId: project.id, userId: session.user.id, status: "pending" },
    select: { id: true },
  });
  if (pending) {
    return Response.json({ ok: true, projectId: project.id, status: "pending", claimId: pending.id });
  }

  const claim = await prisma.projectClaim.create({
    data: {
      projectId: project.id,
      userId: session.user.id,
      userEmail: session.user.email ?? null,
      status: "pending",
      reason,
    },
    select: { id: true },
  });

  return Response.json({ ok: true, projectId: project.id, status: "pending", claimId: claim.id });
}
