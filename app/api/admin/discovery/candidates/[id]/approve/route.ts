import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { approveDiscoveryCandidateImport } from "@/lib/discovery/import-candidate";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let userId: string;
  try {
    ({ userId } = await requireMuHubAdmin());
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
  try {
    const r = await approveDiscoveryCandidateImport(id, userId);
    return Response.json({ ok: true, projectId: r.projectId, slug: r.slug });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: msg }, { status: 400 });
  }
}
