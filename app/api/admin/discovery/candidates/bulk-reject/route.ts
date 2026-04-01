import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { bulkRejectDiscoveryCandidates } from "@/lib/discovery/bulk-candidates";

export const dynamic = "force-dynamic";

async function readIds(req: Request): Promise<string[] | null> {
  try {
    const body = (await req.json()) as { ids?: unknown };
    if (!Array.isArray(body.ids)) {
      return null;
    }
    return body.ids
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
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

  const ids = await readIds(req);
  if (!ids?.length) {
    return Response.json({ ok: false, error: "请提供 ids 数组" }, { status: 400 });
  }

  const results = await bulkRejectDiscoveryCandidates(ids, userId);
  return Response.json({ ok: true, results });
}
