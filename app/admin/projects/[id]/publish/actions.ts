"use server";

import { revalidatePath } from "next/cache";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { writeProjectActionLog } from "@/lib/project-action-log";
import { prisma } from "@/lib/prisma";

export type AdminProjectPublishFormState = {
  ok: boolean;
  message: string;
  refreshedAt?: string;
};

const initialFail: AdminProjectPublishFormState = { ok: false, message: "操作失败" };

function revalidateProjectPublishPaths(projectId: string, slug: string) {
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${projectId}/edit`);
  revalidatePath(`/admin/projects/${projectId}/publish`);
  revalidatePath(`/projects/${slug}`);
}

export async function updateAdminProjectPublishState(
  _prev: AdminProjectPublishFormState,
  formData: FormData,
): Promise<AdminProjectPublishFormState> {
  try {
    await requireMuHubAdmin();
  } catch (error) {
    const message = error instanceof AdminAuthError ? error.message : "无权执行该操作。";
    return { ...initialFail, message };
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const intent = String(formData.get("intent") ?? "").trim();
  if (!projectId) {
    return { ...initialFail, message: "缺少项目 ID。" };
  }

  const existing = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      slug: true,
      status: true,
      visibilityStatus: true,
      isPublic: true,
      publishedAt: true,
    },
  });
  if (!existing) {
    return { ...initialFail, message: "项目不存在或已删除。" };
  }

  try {
    if (intent === "publish") {
      await prisma.$transaction(async (tx) => {
        await tx.project.update({
          where: { id: existing.id },
          data: {
            status: "PUBLISHED",
            visibilityStatus: "PUBLISHED",
            isPublic: true,
            publishedAt: existing.publishedAt ?? new Date(),
          },
        });
        await writeProjectActionLog(
          { projectId: existing.id, action: "publish", detail: "发布设置页执行发布" },
          tx,
        );
      });
    } else if (intent === "unpublish") {
      await prisma.$transaction(async (tx) => {
        await tx.project.update({
          where: { id: existing.id },
          data: {
            status: existing.status === "PUBLISHED" ? "READY" : existing.status,
            visibilityStatus: "DRAFT",
            isPublic: false,
          },
        });
        await writeProjectActionLog(
          { projectId: existing.id, action: "hide", detail: "发布设置页执行取消公开" },
          tx,
        );
      });
    } else if (intent === "hide") {
      await prisma.$transaction(async (tx) => {
        await tx.project.update({
          where: { id: existing.id },
          data: {
            visibilityStatus: "HIDDEN",
            isPublic: false,
          },
        });
        await writeProjectActionLog(
          { projectId: existing.id, action: "hide", detail: "发布设置页执行隐藏" },
          tx,
        );
      });
    } else if (intent === "archive") {
      await prisma.$transaction(async (tx) => {
        await tx.project.update({
          where: { id: existing.id },
          data: {
            status: "ARCHIVED",
            visibilityStatus: "HIDDEN",
            isPublic: false,
          },
        });
        await writeProjectActionLog(
          { projectId: existing.id, action: "archive", detail: "发布设置页执行归档" },
          tx,
        );
      });
    } else {
      return { ...initialFail, message: `未知操作：${intent || "empty"}` };
    }
  } catch (error) {
    console.error("[updateAdminProjectPublishState]", { projectId, intent, error });
    return { ...initialFail, message: "保存失败，请稍后重试。" };
  }

  revalidateProjectPublishPaths(existing.id, existing.slug);
  return { ok: true, message: "发布状态已更新。", refreshedAt: new Date().toISOString() };
}
