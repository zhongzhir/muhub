import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { mergeDiscoveryCandidateToProject } from "@/lib/discovery/import-candidate";

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
  let projectId = "";
  try {
    const body = (await req.json()) as { projectId?: string };
    projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  } catch {
    projectId = "";
  }
  if (!projectId) {
    return Response.json({ ok: false, error: "缺少 projectId" }, { status: 400 });
  }

  try {
    await mergeDiscoveryCandidateToProject(id, projectId, userId);
    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: msg }, { status: 400 });
  }
}
