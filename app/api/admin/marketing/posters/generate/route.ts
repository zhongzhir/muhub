import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { writeProjectActionLog } from "@/lib/project-action-log";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await requireMuHubAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return Response.json(
        { ok: false, error: error.message },
        { status: error.code === "UNAUTHORIZED" ? 401 : 403 },
      );
    }
    throw error;
  }

  const body = (await req.json().catch(() => ({}))) as {
    projectId?: string;
    mode?: string;
  };
  const projectId = String(body.projectId ?? "").trim();
  const mode = String(body.mode ?? "").trim() || "poster";
  if (!projectId) {
    return Response.json({ ok: false, error: "缺少 projectId" }, { status: 400 });
  }

  await writeProjectActionLog({
    projectId,
    action: "marketing_generate",
    detail: `生成海报 mode=${mode}`,
  });
  return Response.json({ ok: true });
}
