import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import {
  buildProjectContentSourceSnapshot,
  generateProjectAIContent,
  saveProjectAIContent,
} from "@/lib/project-ai-content";
import { userOperatorLabel } from "@/lib/project-ai-content-edit-summary";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function canAccess(projectId: string) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return { ok: false as const, status: 401, error: "请先登录。" };
  }

  try {
    await requireMuHubAdmin();
    return { ok: true as const, userId, isAdmin: true };
  } catch (error) {
    if (!(error instanceof AdminAuthError)) throw error;
  }

  const row = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { claimedByUserId: true },
  });
  if (!row) {
    return { ok: false as const, status: 404, error: "项目不存在或已删除。" };
  }
  if (!row.claimedByUserId || row.claimedByUserId !== userId) {
    return { ok: false as const, status: 403, error: "仅已认领项目方或管理员可访问该能力。" };
  }
  return { ok: true as const, userId, isAdmin: false };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const access = await canAccess(id);
  if (!access.ok) {
    return Response.json({ ok: false, error: access.error }, { status: access.status });
  }
  const row = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      aiContent: true,
      aiContentStatus: true,
      aiContentUpdatedAt: true,
      aiContentError: true,
      aiContentDraft: true,
      aiContentDraftUpdatedAt: true,
      aiContentDraftBy: true,
      aiContentDraftStatus: true,
      aiContentDraftStatusUpdatedAt: true,
    },
  });
  if (!row) {
    return Response.json({ ok: false, error: "项目不存在或已删除。" }, { status: 404 });
  }
  let draftOperatorLabel: string | null = null;
  if (row.aiContentDraftBy) {
    const u = await prisma.user.findFirst({
      where: { id: row.aiContentDraftBy },
      select: { name: true, email: true },
    });
    draftOperatorLabel = userOperatorLabel(u, row.aiContentDraftBy);
  }
  return Response.json({
    ok: true,
    projectId: row.id,
    status: row.aiContentStatus ?? "idle",
    content: row.aiContent,
    draft: row.aiContentDraft,
    draftUpdatedAt: row.aiContentDraftUpdatedAt?.toISOString() ?? null,
    draftBy: row.aiContentDraftBy ?? null,
    draftOperatorLabel,
    draftWorkflowStatus: row.aiContentDraftStatus ?? null,
    draftWorkflowStatusUpdatedAt: row.aiContentDraftStatusUpdatedAt?.toISOString() ?? null,
    updatedAt: row.aiContentUpdatedAt?.toISOString() ?? null,
    error: row.aiContentError ?? null,
  });
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const access = await canAccess(id);
  if (!access.ok) {
    return Response.json({ ok: false, error: access.error }, { status: access.status });
  }

  const project = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!project) {
    return Response.json({ ok: false, error: "项目不存在或已删除。" }, { status: 404 });
  }

  await prisma.project.update({
    where: { id: project.id },
    data: {
      aiContentStatus: "pending",
      aiContentError: null,
    },
  });

  try {
    const snapshot = await buildProjectContentSourceSnapshot(project.id);
    if (!snapshot) {
      return Response.json({ ok: false, error: "项目不存在或已删除。" }, { status: 404 });
    }
    const content = await generateProjectAIContent(snapshot);
    const updated = await saveProjectAIContent(project.id, { content });
    await prisma.project.update({
      where: { id: project.id },
      data: {
        aiContentDraft: content,
        aiContentDraftUpdatedAt: new Date(),
        aiContentDraftBy: access.userId,
      },
    });
    const operator = await prisma.user.findFirst({
      where: { id: access.userId },
      select: { name: true, email: true },
    });
    return Response.json({
      ok: true,
      projectId: project.id,
      status: "success",
      content,
      draft: content,
      updatedAt: updated.aiContentUpdatedAt?.toISOString() ?? new Date().toISOString(),
      draftOperatorLabel: userOperatorLabel(operator, access.userId),
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "AI 传播草稿生成失败，请稍后重试。";
    const message =
      raw === "Missing DEEPSEEK_API_KEY"
        ? "AI 服务未配置，请检查服务器环境变量"
        : raw;
    await prisma.project.update({
      where: { id: project.id },
      data: {
        aiContentStatus: "failed",
        aiContentError: message.slice(0, 300),
      },
    });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
