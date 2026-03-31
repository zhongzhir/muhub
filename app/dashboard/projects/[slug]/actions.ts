"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canManageProject } from "@/lib/project-permissions";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";

export async function deleteProject(
  slug: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "请先登录后再删除项目。" };
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "未配置 DATABASE_URL，无法操作。" };
  }

  const row = await prisma.project.findFirst({
    where: { slug, ...PROJECT_ACTIVE_FILTER },
    select: { id: true, createdById: true, claimedByUserId: true },
  });

  if (!row) {
    return { ok: false, error: "项目不存在或已删除。" };
  }

  if (!canManageProject(session.user.id, row)) {
    return { ok: false, error: "你没有权限删除此项目。" };
  }

  await prisma.project.update({
    where: { id: row.id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath(`/projects/${slug}`);
  revalidatePath(`/dashboard/projects/${slug}`, "layout");

  return { ok: true };
}
