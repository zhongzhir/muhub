"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canManageProject } from "@/lib/project-permissions";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";

function revalidateProjectPaths(slug: string) {
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath(`/projects/${slug}`);
  revalidatePath(`/projects/${slug}/share`);
  revalidatePath(`/dashboard/projects/${slug}`, "layout");
  revalidatePath(`/dashboard/projects/${slug}/edit`);
}

export async function publishProject(
  slug: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "请先登录。" };
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "未配置 DATABASE_URL。" };
  }
  const row = await prisma.project.findFirst({
    where: { slug, ...PROJECT_ACTIVE_FILTER },
    select: { id: true, createdById: true, claimedByUserId: true },
  });
  if (!row) {
    return { ok: false, error: "项目不存在或已删除。" };
  }
  if (!canManageProject(session.user.id, row)) {
    return { ok: false, error: "你没有权限操作此项目。" };
  }
  await prisma.project.update({
    where: { id: row.id },
    data: { visibilityStatus: "PUBLISHED", isPublic: true },
  });
  revalidateProjectPaths(slug);
  return { ok: true };
}

export async function hideProject(slug: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "请先登录。" };
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "未配置 DATABASE_URL。" };
  }
  const row = await prisma.project.findFirst({
    where: { slug, ...PROJECT_ACTIVE_FILTER },
    select: { id: true, createdById: true, claimedByUserId: true },
  });
  if (!row) {
    return { ok: false, error: "项目不存在或已删除。" };
  }
  if (!canManageProject(session.user.id, row)) {
    return { ok: false, error: "你没有权限操作此项目。" };
  }
  await prisma.project.update({
    where: { id: row.id },
    data: { visibilityStatus: "HIDDEN", isPublic: false },
  });
  revalidateProjectPaths(slug);
  return { ok: true };
}

/** 预留：运营 / 管理后台可恢复软删项目（当前无 UI） */
export async function restoreProject(slug: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "请先登录。" };
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "未配置 DATABASE_URL。" };
  }
  const row = await prisma.project.findFirst({
    where: { slug, deletedAt: { not: null } },
    select: { id: true, createdById: true, claimedByUserId: true },
  });
  if (!row) {
    return { ok: false, error: "未找到已删除的该项目。" };
  }
  if (!canManageProject(session.user.id, row)) {
    return { ok: false, error: "你没有权限恢复此项目。" };
  }
  await prisma.project.update({
    where: { id: row.id },
    data: { deletedAt: null },
  });
  revalidateProjectPaths(slug);
  return { ok: true };
}

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

  revalidateProjectPaths(slug);

  return { ok: true };
}
