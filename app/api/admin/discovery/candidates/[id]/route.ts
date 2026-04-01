import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireMuHubAdmin();
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return Response.json(
        { ok: false, error: e.message },
        { status: e.code === "UNAUTHORIZED" ? 401 : 403 },
      );
    }
    throw e;
  }

  const { id } = await ctx.params;
  const row = await prisma.discoveryCandidate.findUnique({
    where: { id },
    include: {
      source: { select: { id: true, key: true, name: true, type: true, subtype: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
      matchedProject: { select: { id: true, slug: true, name: true } },
    },
  });

  if (!row) {
    return Response.json({ ok: false, error: "未找到候选" }, { status: 404 });
  }

  const scoreBreakdown =
    row.score != null
      ? {
          score: row.score,
          popularityScore: row.popularityScore,
          freshnessScore: row.freshnessScore,
          qualityScore: row.qualityScore,
        }
      : null;

  return Response.json({
    ok: true,
    candidate: {
      ...row,
      firstSeenAt: row.firstSeenAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      lastCommitAt: row.lastCommitAt?.toISOString() ?? null,
      repoCreatedAt: row.repoCreatedAt?.toISOString() ?? null,
      repoUpdatedAt: row.repoUpdatedAt?.toISOString() ?? null,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      scoreBreakdown,
    },
  });
}
