import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { acceptDiscoveryClassification } from "@/lib/discovery/classification/accept-classification";

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

  const { id: candidateId } = await ctx.params;
  try {
    const out = await acceptDiscoveryClassification(candidateId);
    return Response.json({ ok: true, ...out });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("不存在") ? 404 : 400;
    return Response.json({ ok: false, error: msg }, { status });
  }
}
