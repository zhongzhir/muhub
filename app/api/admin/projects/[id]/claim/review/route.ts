import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireMuHubAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return Response.json(
        { ok: false, error: error.message },
        { status: error.code === "UNAUTHORIZED" ? 401 : 403 },
      );
    }
    throw error;
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { action?: "approve" | "reject" };
  if (body.action !== "approve" && body.action !== "reject") {
    return Response.json({ ok: false, error: "无效审核动作。" }, { status: 400 });
  }

  const pendingClaim = await prisma.projectClaim.findFirst({
    where: { projectId: id, status: "pending" },
    orderBy: { createdAt: "asc" },
    select: { id: true, userId: true },
  });
  if (!pendingClaim) {
    return Response.json({ ok: false, error: "没有待审核认领请求。" }, { status: 404 });
  }

  const reviewedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.projectClaim.update({
      where: { id: pendingClaim.id },
      data: {
        status: body.action === "approve" ? "approved" : "rejected",
        reviewedAt,
      },
    });
    if (body.action === "approve") {
      await tx.project.update({
        where: { id },
        data: {
          claimStatus: "CLAIMED",
          claimedByUserId: pendingClaim.userId,
          claimedAt: reviewedAt,
        },
      });
    }
  });

  return Response.json({
    ok: true,
    projectId: id,
    status: body.action === "approve" ? "approved" : "rejected",
  });
}
