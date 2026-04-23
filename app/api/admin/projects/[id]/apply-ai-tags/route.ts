import { revalidatePath } from "next/cache";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ApplyTagsBody = {
  mode?: "append" | "replace";
  tags?: string[];
};

function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const unique = new Set<string>();
  for (const item of input) {
    if (typeof item !== "string") continue;
    const tag = item.trim();
    if (!tag) continue;
    unique.add(tag);
    if (unique.size >= 20) break;
  }
  return [...unique];
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let admin: { userId: string; email?: string | null };
  try {
    admin = await requireMuHubAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return Response.json(
        { ok: false, error: error.message },
        { status: error.code === "UNAUTHORIZED" ? 401 : 403 },
      );
    }
    throw error;
  }

  const body = (await req.json().catch(() => ({}))) as ApplyTagsBody;
  const mode: "append" | "replace" = body.mode === "replace" ? "replace" : "append";
  const { id } = await ctx.params;

  const row = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      slug: true,
      tags: true,
      aiSuggestedTags: true,
    },
  });
  if (!row) {
    return Response.json({ ok: false, error: "项目不存在或已删除。" }, { status: 404 });
  }

  const suggested = normalizeTags(row.aiSuggestedTags);
  const selected = normalizeTags(body.tags);
  const source = selected.length ? selected : suggested;
  if (!source.length) {
    return Response.json({ ok: false, error: "暂无可应用的 AI 推荐标签。" }, { status: 400 });
  }

  const nextTags =
    mode === "replace"
      ? source
      : [...new Set([...row.tags, ...source])];

  await prisma.project.update({
    where: { id: row.id },
    data: { tags: nextTags },
  });
  await prisma.projectAiOpsLog.create({
    data: {
      projectId: row.id,
      operatorId: admin.userId,
      operatorEmail: admin.email ?? null,
      action: "apply_tags",
      mode,
      before: { tags: row.tags },
      after: { tags: nextTags },
      appliedItems: { tags: source },
    },
  });

  revalidatePath(`/admin/projects/${row.id}/edit`);
  revalidatePath(`/projects/${row.slug}`);
  return Response.json({ ok: true, projectId: row.id, mode, tags: nextTags });
}
