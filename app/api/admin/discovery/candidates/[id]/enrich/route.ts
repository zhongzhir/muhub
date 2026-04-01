import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { runDiscoveryEnrichment } from "@/lib/discovery/enrichment/run-enrichment-job";

export const dynamic = "force-dynamic";

export async function POST(
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
  const result = await runDiscoveryEnrichment(id);
  if (!result.ok) {
    const notFound = result.error === "候选不存在";
    return Response.json(
      {
        ok: false,
        error: result.error,
        jobId: result.jobId,
        logs: result.logs,
        extractedCount: result.extractedCount,
      },
      { status: notFound ? 404 : 500 },
    );
  }
  return Response.json({
    ok: true,
    jobId: result.jobId,
    extractedCount: result.extractedCount,
    logs: result.logs,
  });
}
