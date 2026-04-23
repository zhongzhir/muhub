import { revalidatePath } from "next/cache";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { normalizeSuggestedCategories } from "@/lib/tag-normalization";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ApplyCategoriesBody = {
  mode?: "append" | "replace";
  categories?: {
    primary?: string;
    secondary?: string;
    optional?: string[];
  };
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(list: string[], limit = 10): string[] {
  const unique = new Set<string>();
  for (const item of list) {
    const text = item.trim();
    if (!text) continue;
    unique.add(text);
    if (unique.size >= limit) break;
  }
  return [...unique];
}

function parseSuggestedCategories(value: unknown) {
  const obj = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const primary = clean(obj.primary) || undefined;
  const secondary = clean(obj.secondary) || undefined;
  const optionalRaw = Array.isArray(obj.optional)
    ? obj.optional.map((item) => clean(item))
    : [];
  return normalizeSuggestedCategories({
    primary,
    secondary,
    optional: uniqueStrings(optionalRaw, 8),
  });
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

  const body = (await req.json().catch(() => ({}))) as ApplyCategoriesBody;
  const mode: "append" | "replace" = body.mode === "replace" ? "replace" : "append";
  const { id } = await ctx.params;

  const row = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      slug: true,
      primaryCategory: true,
      categoriesJson: true,
      aiSuggestedCategories: true,
    },
  });
  if (!row) {
    return Response.json({ ok: false, error: "项目不存在或已删除。" }, { status: 404 });
  }

  const suggested = parseSuggestedCategories(row.aiSuggestedCategories);
  const selected = parseSuggestedCategories(body.categories ?? {});
  const primary = selected.primary || suggested.primary || "";
  const secondary = selected.secondary || suggested.secondary || "";
  const optional = selected.optional.length ? selected.optional : suggested.optional;
  if (!primary && !secondary && !optional.length) {
    return Response.json({ ok: false, error: "暂无可应用的 AI 推荐分类。" }, { status: 400 });
  }

  const existing = Array.isArray(row.categoriesJson)
    ? row.categoriesJson.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
  const incoming = uniqueStrings([primary, secondary, ...optional].filter(Boolean) as string[], 10);
  const merged = mode === "replace" ? incoming : uniqueStrings([...existing, ...incoming], 10);
  const nextPrimary = mode === "replace"
    ? (primary || secondary || optional[0] || null)
    : (row.primaryCategory || primary || secondary || optional[0] || null);

  await prisma.project.update({
    where: { id: row.id },
    data: {
      primaryCategory: nextPrimary,
      categoriesJson: merged,
    },
  });
  await prisma.projectAiOpsLog.create({
    data: {
      projectId: row.id,
      operatorId: admin.userId,
      operatorEmail: admin.email ?? null,
      action: "apply_categories",
      mode,
      before: {
        primaryCategory: row.primaryCategory,
        categories: existing,
      },
      after: {
        primaryCategory: nextPrimary,
        categories: merged,
      },
      appliedItems: {
        primary,
        secondary,
        optional,
      },
    },
  });

  revalidatePath(`/admin/projects/${row.id}/edit`);
  revalidatePath(`/projects/${row.slug}`);
  return Response.json({
    ok: true,
    projectId: row.id,
    mode,
    primaryCategory: nextPrimary,
    categories: merged,
  });
}
