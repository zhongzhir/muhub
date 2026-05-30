import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { scheduleEnrichProjectAfterImport } from "@/lib/discovery/post-import-project-ai";
import {
  buildPublishProjectUpdateData,
  evaluateProjectPublishReadiness,
  PARTIAL_AI_PUBLISH_NOTICE,
  type BulkPublishItemResult,
} from "@/lib/project-publishing";
import { prisma } from "@/lib/prisma";
import { writeProjectActionLog } from "@/lib/project-action-log";
import { refreshProjectGithubFacts } from "@/lib/github-sync";
import { resolveProjectGithubUrl } from "@/lib/project-evidence-context";

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
    return Response.json({
      ok: false,
      error: "未选择项目",
      processed: 0,
      publishedCount: 0,
      blockedCount: 0,
      skippedCount: 0,
      counts: {
        processed: 0,
        published: 0,
        blocked: 0,
        skipped: 0,
      },
    }, { status: 400 });
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
      aiStatus: true,
      tagline: true,
      description: true,
      primaryCategory: true,
      websiteUrl: true,
      githubUrl: true,
      sourceType: true,
      sources: {
        select: { kind: true, url: true, label: true },
      },
    },
  });

  if (intent === "publish") {
    const published: BulkPublishItemResult[] = [];
    const skipped: BulkPublishItemResult[] = [];
    const blocked: BulkPublishItemResult[] = [];
    const partial_ai: BulkPublishItemResult[] = [];

    for (const row of rows) {
      const itemBase = { id: row.id, name: row.name, slug: row.slug };

      if (row.status !== "DRAFT") {
        skipped.push({
          ...itemBase,
          reason: row.status === "PUBLISHED" ? "项目已发布，不参与批量发布" : `项目状态为 ${row.status}，仅 DRAFT 可批量发布`,
        });
        continue;
      }

      const readiness = evaluateProjectPublishReadiness({
        id: row.id,
        name: row.name,
        slug: row.slug,
        status: row.status,
        publishedAt: row.publishedAt,
        aiInsightStatus: row.aiInsightStatus,
        aiContentStatus: row.aiContentStatus,
        aiKnowledgeJson: row.aiKnowledgeJson,
        aiStatus: row.aiStatus,
        tagline: row.tagline,
        description: row.description,
        primaryCategory: row.primaryCategory,
        websiteUrl: row.websiteUrl,
        githubUrl: row.githubUrl,
        sources: row.sources,
      });

      if (readiness.outcome === "skipped") {
        skipped.push({
          ...itemBase,
          reason: readiness.issues[0] ?? "已跳过",
        });
        continue;
      }

      if (readiness.outcome === "blocked") {
        if (row.aiInsightStatus !== "success" || row.aiContentStatus !== "success") {
          scheduleEnrichProjectAfterImport(row.id, {
            source: row.sourceType === "discovery-json-queue" ? "github_queue" : "manual",
            skipPublish: true,
          });
        }
        blocked.push({
          ...itemBase,
          issues: readiness.issues,
          reason: readiness.issues.join("；"),
        });
        continue;
      }

      try {
        const repoUrl = resolveProjectGithubUrl({
          githubUrl: row.githubUrl,
          sources: row.sources,
        });
        if (repoUrl) {
          const githubRefresh = await refreshProjectGithubFacts(row.id);
          if (!githubRefresh.ok) {
            console.warn("[bulk-action] github facts refresh failed before publish", {
              projectId: row.id,
              slug: row.slug,
              lastFetchError: githubRefresh.lastFetchError,
            });
          }
        }

        await prisma.$transaction(async (tx) => {
          await tx.project.update({
            where: { id: row.id },
            data: buildPublishProjectUpdateData({
              publishedAt: row.publishedAt,
              primaryCategory: readiness.primaryCategory,
              readiness,
            }),
          });
          await writeProjectActionLog(
            {
              projectId: row.id,
              action: "publish",
              detail:
                readiness.publishQuality === "partial_ai"
                  ? `项目列表批量发布（partial_ai）：${PARTIAL_AI_PUBLISH_NOTICE}`
                  : "项目列表批量发布",
            },
            tx,
          );
        });

        if (readiness.publishQuality === "partial_ai") {
          partial_ai.push({
            ...itemBase,
            notice: readiness.notice ?? PARTIAL_AI_PUBLISH_NOTICE,
          });
        } else {
          published.push(itemBase);
        }
      } catch (error) {
        blocked.push({
          ...itemBase,
          reason: error instanceof Error ? error.message : "发布失败",
        });
      }
    }

    const missingIds = ids.filter((id) => !rows.some((row) => row.id === id));
    for (const id of missingIds) {
      skipped.push({
        id,
        name: id,
        slug: id,
        reason: "项目不存在或已删除",
      });
    }

    const publishedCount = published.length + partial_ai.length;
    const blockedCount = blocked.length;
    const skippedCount = skipped.length;
    const processed = publishedCount + blockedCount + skippedCount;
    return Response.json({
      ok: true,
      intent,
      count: processed,
      processed,
      publishedCount,
      blockedCount,
      skippedCount,
      counts: {
        processed,
        published: publishedCount,
        blocked: blockedCount,
        skipped: skippedCount,
      },
      published,
      skipped,
      blocked,
      partial_ai,
      message:
        partial_ai.length > 0
          ? `${PARTIAL_AI_PUBLISH_NOTICE}（${partial_ai.length} 个项目为 partial_ai）`
          : undefined,
    });
  }

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      if (intent === "hide") {
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

  return Response.json({ ok: true, count: rows.length, intent });
}
