import { revalidatePath } from "next/cache";

import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { createMobileCaptureItem } from "@/lib/discovery/mobile-capture";
import {
  autoExtractProjectsFromCapturedUrl,
  persistMobileAutoExtractionResult,
} from "@/lib/discovery/mobile-auto-extraction";

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const title = typeof input.title === "string" ? input.title : undefined;
  const content = typeof input.content === "string" ? input.content : "";
  const sourceNote = typeof input.sourceNote === "string" ? input.sourceNote : undefined;

  if (!content.trim()) {
    return Response.json({ ok: false, error: "content is required" }, { status: 400 });
  }

  const result = await createMobileCaptureItem({ title, content, sourceNote });
  const autoExtraction = await autoExtractProjectsFromCapturedUrl({
    duplicate: result.duplicate,
    extractedUrl: result.extractedUrl,
    sourceNote,
  });
  if (!result.duplicate) {
    await persistMobileAutoExtractionResult(result.itemId, autoExtraction);
  }
  revalidatePath("/admin/discovery/items");
  revalidatePath("/admin/discovery/mobile");
  revalidatePath("/admin/discovery");

  return Response.json({
    ok: true,
    itemId: result.itemId,
    title: result.title,
    extractedUrl: result.extractedUrl,
    isWechatArticle: result.isWechatArticle,
    duplicate: result.duplicate,
    autoExtraction,
  });
}
