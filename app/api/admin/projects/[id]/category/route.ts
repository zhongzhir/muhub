import { revalidatePath } from "next/cache";

import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { recordOperatorCategoryChange } from "@/lib/operator-learning";
import { prisma } from "@/lib/prisma";
import { normalizePrimaryCategoryToSlug } from "@/lib/projects/project-categories";

export const dynamic = "force-dynamic";

function authError(error: unknown) {
  if (error instanceof AdminAuthError) {
    return Response.json(
      { ok: false, error: error.message },
      { status: error.code === "UNAUTHORIZED" ? 401 : 403 },
    );
  }
  throw error;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireMuHubAdmin();
  } catch (error) {
    return authError(error);
  }

  const body = (await req.json().catch(() => ({}))) as { category?: unknown };
  const rawCategory = typeof body.category === "string" ? body.category : "";
  const primaryCategory = normalizePrimaryCategoryToSlug(rawCategory);
  if (rawCategory.trim() && rawCategory !== "uncategorized" && !primaryCategory) {
    return Response.json({ ok: false, error: "Invalid category" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const row = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, slug: true, name: true, primaryCategory: true, tags: true, tagline: true, description: true },
  });
  if (!row) {
    return Response.json({ ok: false, error: "Project not found" }, { status: 404 });
  }

  await prisma.project.update({
    where: { id: row.id },
    data: { primaryCategory },
  });

  await recordOperatorCategoryChange({
    projectId: row.id,
    projectName: row.name,
    beforeCategory: row.primaryCategory,
    afterCategory: primaryCategory,
    signalTags: row.tags,
    signalText: [row.name, row.tagline, row.description].filter(Boolean).join(" "),
  });

  revalidatePath(`/admin/projects/${row.id}/edit`);
  revalidatePath(`/projects/${row.slug}`);

  return Response.json({
    ok: true,
    projectId: row.id,
    primaryCategory,
  });
}
