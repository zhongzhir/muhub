import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { runDiscoverySourceByKey } from "@/lib/discovery/run-discovery-source";

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

  let body: { sourceKey?: string } = {};
  try {
    body = (await req.json()) as { sourceKey?: string };
  } catch {
    body = {};
  }
  const sourceKey = typeof body.sourceKey === "string" ? body.sourceKey.trim() : "";
  if (!sourceKey) {
    return Response.json({ ok: false, error: "缺少 sourceKey" }, { status: 400 });
  }

  const result = await runDiscoverySourceByKey(sourceKey);
  if (!result.ok) {
    const { ok, ...rest } = result;
    void ok;
    return Response.json({ ok: false, ...rest }, { status: 500 });
  }
  const { ok, ...restOk } = result;
  void ok;
  return Response.json({ ok: true, ...restOk });
}
