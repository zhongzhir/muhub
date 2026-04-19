"use server";

import { revalidatePath } from "next/cache";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import {
  parseAdminProjectInput,
  validateProjectForPublish,
} from "@/lib/admin-project-edit";
import { prisma } from "@/lib/prisma";

export type AdminProjectEditFormState = {
  ok: boolean;
  formError?: string;
  redirectPath?: string;
};

const initialFail: AdminProjectEditFormState = { ok: false };

function revalidateProjectPaths(projectId: string, slug: string) {
  revalidatePath("/admin/discovery");
  revalidatePath(`/admin/projects/${projectId}/edit`);
  revalidatePath("/projects");
  revalidatePath(`/projects/${slug}`);
}

export async function saveAdminProject(
  _prev: AdminProjectEditFormState,
  formData: FormData,
): Promise<AdminProjectEditFormState> {
  try {
    await requireMuHubAdmin();
  } catch (error) {
    const message = error instanceof AdminAuthError ? error.message : "无权操作该项目。";
    return { ...initialFail, formError: message };
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const intent = String(formData.get("intent") ?? "save").trim();
  if (!projectId) {
    return { ...initialFail, formError: "缺少项目 ID，无法保存。" };
  }

  const existing = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      slug: true,
      status: true,
      publishedAt: true,
    },
  });

  if (!existing) {
    return { ...initialFail, formError: "项目不存在或已删除。" };
  }

  let parsed;
  try {
    parsed = parseAdminProjectInput(formData);
  } catch (error) {
    return {
      ...initialFail,
      formError: error instanceof Error ? error.message : "表单解析失败，请检查输入内容。",
    };
  }

  const publishValidation = validateProjectForPublish(parsed);
  const nextDraftStatus =
    existing.status === "PUBLISHED"
      ? "PUBLISHED"
      : publishValidation.ok
        ? "READY"
        : "DRAFT";

  if (intent === "publish" && !publishValidation.ok) {
    return {
      ...initialFail,
      formError: `发布前请先补齐以下信息：${publishValidation.errors.join("；")}`,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: existing.id },
        data: {
          name: parsed.name,
          tagline: parsed.tagline,
          description: parsed.description,
          primaryCategory: parsed.primaryCategory,
          tags: parsed.tags,
          websiteUrl: parsed.websiteUrl,
          githubUrl: parsed.githubUrl,
          aiCardSummary: parsed.aiCardSummary,
          status: intent === "publish" ? "PUBLISHED" : nextDraftStatus,
          visibilityStatus: intent === "publish" ? "PUBLISHED" : "DRAFT",
          isPublic: intent === "publish",
          publishedAt:
            intent === "publish"
              ? existing.publishedAt ?? new Date()
              : existing.status === "PUBLISHED"
                ? existing.publishedAt
                : null,
        },
      });

      await tx.projectExternalLink.deleteMany({ where: { projectId: existing.id } });
      if (parsed.externalLinks.length > 0) {
        await tx.projectExternalLink.createMany({
          data: parsed.externalLinks.map((item) => ({
            projectId: existing.id,
            platform: item.platform,
            url: item.url,
            label: item.label,
            isPrimary: item.isPrimary,
            source: "admin-edit",
          })),
        });
      }
    });
  } catch (error) {
    console.error("[saveAdminProject]", error);
    return { ...initialFail, formError: "保存失败，请稍后重试。" };
  }

  revalidateProjectPaths(existing.id, existing.slug);

  if (intent === "publish") {
    return {
      ok: true,
      redirectPath: `/projects/${existing.slug}`,
    };
  }

  return { ok: true };
}
