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

  const { id: candidateId } = await ctx.params;
  const exists = await prisma.discoveryCandidate.findUnique({
    where: { id: candidateId },
    select: { id: true },
  });
  if (!exists) {
    return Response.json({ ok: false, error: "候选不存在" }, { status: 404 });
  }

  const links = await prisma.discoveryEnrichmentLink.findMany({
    where: { candidateId },
    orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      platform: true,
      url: true,
      normalizedUrl: true,
      host: true,
      source: true,
      confidence: true,
      isPrimary: true,
      isAccepted: true,
      evidenceText: true,
      jobId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Response.json({
    ok: true,
    links: links.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    })),
  });
}
