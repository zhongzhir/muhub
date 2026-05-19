import { revalidatePath } from "next/cache";

import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { findDiscoveryItemByUrl } from "@/agents/discovery/discovery-store";
import { createMobileCaptureItem } from "@/lib/discovery/mobile-capture";
import {
  autoExtractMobileCaptureItemById,
  autoExtractProjectsFromCapturedUrl,
  persistMobileAutoExtractionResult,
  type MobileCaptureAutoExtraction,
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

  let autoExtraction: MobileCaptureAutoExtraction;
  if (result.duplicate && result.extractedUrl) {
    const existing = await findDiscoveryItemByUrl(result.extractedUrl);
    if (existing?.id) {
      autoExtraction = await autoExtractMobileCaptureItemById(existing.id);
    } else {
      autoExtraction = { attempted: false, reason: "duplicate" };
    }
  } else {
    autoExtraction = await autoExtractProjectsFromCapturedUrl({
      extractedUrl: result.extractedUrl,
      sourceNote,
    });
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
