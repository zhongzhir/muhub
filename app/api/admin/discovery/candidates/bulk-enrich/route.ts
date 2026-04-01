import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { runDiscoveryEnrichment } from "@/lib/discovery/enrichment/run-enrichment-job";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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

  let ids: string[] = [];
  try {
    const body = (await req.json()) as { ids?: unknown };
    if (Array.isArray(body.ids)) {
      ids = body.ids.filter((x): x is string => typeof x === "string").map((x) => x.trim());
    }
  } catch {
    ids = [];
  }
  ids = [...new Set(ids.filter(Boolean))];
  if (ids.length === 0) {
    return Response.json({ ok: false, error: "请提供 ids" }, { status: 400 });
  }

  const results: {
    id: string;
    success: boolean;
    jobId?: string;
    extractedCount?: number;
    reason?: string;
  }[] = [];

  for (const id of ids) {
    try {
      const r = await runDiscoveryEnrichment(id);
      if (r.ok) {
        results.push({
          id,
          success: true,
          jobId: r.jobId,
          extractedCount: r.extractedCount,
        });
      } else {
        results.push({
          id,
          success: false,
          jobId: r.jobId || undefined,
          reason: r.error,
        });
      }
    } catch (e) {
      results.push({
        id,
        success: false,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return Response.json({ ok: true, results });
}
