import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { writeProjectActionLog } from "@/lib/project-action-log";

export const dynamic = "force-dynamic";

type BulkIntent = "publish" | "hide" | "archive";

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
    ids?: string[];
    intent?: BulkIntent;
  };
  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.map((item) => String(item).trim()).filter(Boolean))]
    : [];
  const intent = body.intent;
  if (!ids.length) {
    return Response.json({ ok: false, error: "请选择至少一个项目。" }, { status: 400 });
  }
  if (intent !== "publish" && intent !== "hide" && intent !== "archive") {
    return Response.json({ ok: false, error: "不支持的批量操作。" }, { status: 400 });
  }

  const rows = await prisma.project.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, status: true, publishedAt: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      if (intent === "publish") {
        await tx.project.update({
          where: { id: row.id },
          data: {
            status: "PUBLISHED",
            visibilityStatus: "PUBLISHED",
            isPublic: true,
            publishedAt: row.publishedAt ?? new Date(),
          },
        });
        await writeProjectActionLog(
          {
            projectId: row.id,
            action: "publish",
            detail: "项目列表批量发布",
          },
          tx,
        );
      } else if (intent === "hide") {
        await tx.project.update({
          where: { id: row.id },
          data: {
            status: row.status === "PUBLISHED" ? "READY" : row.status,
            visibilityStatus: "HIDDEN",
            isPublic: false,
          },
        });
        await writeProjectActionLog(
          {
            projectId: row.id,
            action: "hide",
            detail: "项目列表批量隐藏",
          },
          tx,
        );
      } else {
        await tx.project.update({
          where: { id: row.id },
          data: {
            status: "ARCHIVED",
            visibilityStatus: "HIDDEN",
            isPublic: false,
          },
        });
        await writeProjectActionLog(
          {
            projectId: row.id,
            action: "archive",
            detail: "项目列表批量归档",
          },
          tx,
        );
      }
    }
  });

  return Response.json({ ok: true, count: rows.length });
}
