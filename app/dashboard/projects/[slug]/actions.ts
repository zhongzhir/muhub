"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canManageProject } from "@/lib/project-permissions";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";
import { validateProjectForPublish } from "@/lib/admin-project-edit";

function revalidateProjectPaths(slug: string) {
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath(`/projects/${slug}`);
  revalidatePath(`/projects/${slug}/share`);
  revalidatePath(`/dashboard/projects/${slug}`, "layout");
  revalidatePath(`/dashboard/projects/${slug}/edit`);
}

async function loadProjectForManage(slug: string, userId: string) {
  const row = await prisma.project.findFirst({
    where: { slug, ...PROJECT_ACTIVE_FILTER },
    select: {
      id: true,
      slug: true,
      createdById: true,
      claimedByUserId: true,
      name: true,
      tagline: true,
      description: true,
      primaryCategory: true,
      tags: true,
      websiteUrl: true,
      githubUrl: true,
      publishedAt: true,
      externalLinks: {
        select: { platform: true, url: true, label: true, isPrimary: true },
      },
    },
  });

  if (!row) {
    return { ok: false as const, error: "项目不存在或已删除。" };
  }
  if (!canManageProject(userId, row)) {
    return { ok: false as const, error: "你没有权限操作此项目。" };
  }
  return { ok: true as const, row };
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

  const loaded = await loadProjectForManage(slug, session.user.id);
  if (!loaded.ok) {
    return loaded;
  }

  const validation = validateProjectForPublish({
    name: loaded.row.name,
    tagline: loaded.row.tagline,
    description: loaded.row.description,
    primaryCategory: loaded.row.primaryCategory,
    tags: loaded.row.tags,
    websiteUrl: loaded.row.websiteUrl,
    githubUrl: loaded.row.githubUrl,
    aiCardSummary: null,
    externalLinks: loaded.row.externalLinks,
  });

  if (!validation.ok) {
    return {
      ok: false,
      error: `发布前请先补齐：${validation.blockingErrors.join("；")}`,
    };
  }

  await prisma.project.update({
    where: { id: loaded.row.id },
    data: {
      status: "PUBLISHED",
      visibilityStatus: "PUBLISHED",
      isPublic: true,
      publishedAt: loaded.row.publishedAt ?? new Date(),
    },
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

  const loaded = await loadProjectForManage(slug, session.user.id);
  if (!loaded.ok) {
    return loaded;
  }

  const nextStatus = loaded.row.publishedAt ? "READY" : "DRAFT";

  await prisma.project.update({
    where: { id: loaded.row.id },
    data: {
      status: nextStatus,
      visibilityStatus: "HIDDEN",
      isPublic: false,
    },
  });
  revalidateProjectPaths(slug);
  return { ok: true };
}

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
    data: { deletedAt: new Date(), status: "ARCHIVED", visibilityStatus: "HIDDEN", isPublic: false },
  });

  revalidateProjectPaths(slug);

  return { ok: true };
}
