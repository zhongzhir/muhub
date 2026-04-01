import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { rejectDiscoveryCandidate } from "@/lib/discovery/import-candidate";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
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
  let note: string | undefined;
  try {
    const body = (await req.json()) as { note?: string };
    note = typeof body.note === "string" ? body.note : undefined;
  } catch {
    note = undefined;
  }

  try {
    await rejectDiscoveryCandidate(id, userId, note);
    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: msg }, { status: 400 });
  }
}
