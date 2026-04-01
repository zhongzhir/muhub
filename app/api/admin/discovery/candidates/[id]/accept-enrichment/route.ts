import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { acceptDiscoveryEnrichmentLinks } from "@/lib/discovery/enrichment/accept-enrichment";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
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
  let linkIds: string[] = [];
  try {
    const body = (await req.json()) as { linkIds?: unknown };
    if (Array.isArray(body.linkIds)) {
      linkIds = body.linkIds.filter((x): x is string => typeof x === "string");
    }
  } catch {
    linkIds = [];
  }
  if (linkIds.length === 0) {
    return Response.json({ ok: false, error: "请提供 linkIds" }, { status: 400 });
  }

  try {
    const result = await acceptDiscoveryEnrichmentLinks(candidateId, linkIds);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: msg }, { status: 400 });
  }
}
