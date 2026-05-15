import { revalidatePath } from "next/cache";

import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { autoExtractMobileCaptureItemById } from "@/lib/discovery/mobile-auto-extraction";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
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

  const { id } = await context.params;
  if (!id.trim()) {
    return Response.json({ ok: false, error: "id is required" }, { status: 400 });
  }

  const autoExtraction = await autoExtractMobileCaptureItemById(id);
  revalidatePath("/admin/discovery/items");
  revalidatePath("/admin/discovery/mobile");
  revalidatePath("/admin/discovery");

  return Response.json({ ok: true, autoExtraction });
}
