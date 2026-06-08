import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { readDiscoveryFeedbackRecords } from "@/lib/discovery/feedback-capture";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const limit = Math.min(10000, Math.max(1, Number(searchParams.get("limit")) || 5000));
  const rows = await readDiscoveryFeedbackRecords(limit);
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  const filename = `entity-feedback-dataset-${new Date().toISOString().slice(0, 10)}.jsonl`;

  return new Response(body ? `${body}\n` : "", {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
