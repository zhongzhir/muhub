import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { scheduleEnrichProjectAfterImport } from "@/lib/discovery/post-import-project-ai";
import { prisma } from "@/lib/prisma";
import { writeProjectActionLog } from "@/lib/project-action-log";

export const dynamic = "force-dynamic";

type BulkIntent = "publish" | "hide" | "archive";

type ProjectBulkRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  publishedAt: Date | null;
  aiInsightStatus: string | null;
  aiContentStatus: string | null;
  aiKnowledgeJson: unknown;
  tagline: string | null;
  description: string | null;
  sourceType: string | null;
};

function publishReadinessIssues(row: ProjectBulkRow): string[] {
  const issues: string[] = [];
  if (row.aiInsightStatus !== "success") {
    issues.push("AI 认知卡未成功生成");
  }
  if (row.aiContentStatus !== "success") {
    issues.push("AI 增强版内容未成功生成");
  }
  if (!row.aiKnowledgeJson || typeof row.aiKnowledgeJson !== "object") {
    issues.push("缺少 AI 知识库（aiKnowledgeJson）");
  }
  if (!row.tagline?.trim()) {
    issues.push("缺少一句话简介");
  }
  if (!row.description?.trim()) {
    issues.push("缺少项目简介");
  }
  return issues;
}

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
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      publishedAt: true,
      aiInsightStatus: true,
      aiContentStatus: true,
      aiKnowledgeJson: true,
      tagline: true,
      description: true,
      sourceType: true,
    },
  });

  if (intent === "publish") {
    const blocked = rows
      .map((row) => ({ row, issues: publishReadinessIssues(row) }))
      .filter((item) => item.issues.length > 0);

    for (const item of blocked) {
      if (item.row.aiInsightStatus !== "success" || item.row.aiContentStatus !== "success") {
        scheduleEnrichProjectAfterImport(item.row.id, {
          source: item.row.sourceType === "discovery-json-queue" ? "github_queue" : "manual",
          skipPublish: true,
        });
      }
    }

    if (blocked.length > 0) {
      const preview = blocked
        .slice(0, 5)
        .map((item) => `${item.row.name}（${item.issues.join("；")}）`)
        .join("；");
      return Response.json(
        {
          ok: false,
          error: `有 ${blocked.length} 个项目尚未完成 AI enrichment，已阻止批量发布并尝试重新触发 AI：${preview}${blocked.length > 5 ? "…" : ""}`,
          blockedCount: blocked.length,
        },
        { status: 400 },
      );
    }
  }

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
