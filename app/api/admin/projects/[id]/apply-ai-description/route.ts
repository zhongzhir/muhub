import { revalidatePath } from "next/cache";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { normalizeChineseExpression, normalizeChineseList } from "@/lib/zh-normalization";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return normalizeChineseList(v.map((item) => asString(item)).filter(Boolean));
}

function buildHumanReadableProjectDetail(aiInsight: unknown): { description: string } | null {
  const obj = aiInsight && typeof aiInsight === "object" ? (aiInsight as Record<string, unknown>) : {};
  const whatItIs = normalizeChineseExpression(asString(obj.whatItIs));
  const whoFor = asList(obj.whoFor);
  const useCases = asList(obj.useCases);
  const summary = normalizeChineseExpression(asString(obj.summary));

  if (!whatItIs && !summary && whoFor.length === 0 && useCases.length === 0) {
    return null;
  }

  const lines: string[] = [];
  lines.push(whatItIs || summary || "这是一个面向真实业务场景的项目。");
  if (whoFor.length) {
    lines.push(`它更适合：${whoFor.slice(0, 4).join("、")}。`);
  }
  if (useCases.length) {
    lines.push(`典型使用场景包括：${useCases.slice(0, 4).join("；")}。`);
  }
  lines.push("以上内容基于当前 AI 结构化整理，发布前请结合官方信息做最终校对。");
  return {
    description: normalizeChineseExpression(lines.join("\n\n")).slice(0, 3000),
  };
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let admin: { userId: string; email?: string | null };
  try {
    admin = await requireMuHubAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return Response.json({ ok: false, error: error.message }, { status: error.code === "UNAUTHORIZED" ? 401 : 403 });
    }
    throw error;
  }

  const { id } = await ctx.params;
  const row = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, slug: true, description: true, aiInsight: true },
  });
  if (!row) return Response.json({ ok: false, error: "项目不存在或已删除。" }, { status: 404 });

  const next = buildHumanReadableProjectDetail(row.aiInsight);
  if (!next) {
    return Response.json({ ok: false, error: "AI 认知卡中暂无可应用的项目介绍信息。" }, { status: 400 });
  }

  await prisma.project.update({
    where: { id: row.id },
    data: {
      description: next.description,
    },
  });
  await prisma.projectAiOpsLog.create({
    data: {
      projectId: row.id,
      operatorId: admin.userId,
      operatorEmail: admin.email ?? null,
      action: "apply_ai_description",
      mode: "replace",
      before: {
        description: row.description ?? "",
      },
      after: next,
      appliedItems: { from: ["aiInsight.whatItIs", "aiInsight.whoFor", "aiInsight.useCases"] },
    },
  });

  revalidatePath(`/admin/projects/${row.id}/edit`);
  revalidatePath(`/projects/${row.slug}`);
  return Response.json({ ok: true, projectId: row.id, ...next });
}
