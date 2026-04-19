"use server";

import { revalidatePath } from "next/cache";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import {
  parseAdminProjectInput,
  validateProjectForPublish,
  type ParsedAdminProjectInput,
} from "@/lib/admin-project-edit";
import { prisma } from "@/lib/prisma";

export type AdminProjectEditFormState = {
  ok: boolean;
  action: "save" | "publish" | null;
  formError?: string;
  toast?: {
    kind: "success" | "error";
    message: string;
  };
  redirectPath?: string;
  refreshedAt?: string;
  statusSnapshot?: {
    status: string;
    visibilityStatus: string;
    isPublic: boolean;
    publishedAt: string | null;
  };
};

const initialFail: AdminProjectEditFormState = { ok: false, action: null };

function revalidateProjectPaths(projectId: string, slug: string) {
  revalidatePath("/admin/discovery");
  revalidatePath(`/admin/projects/${projectId}/edit`);
  revalidatePath("/projects");
  revalidatePath(`/projects/${slug}`);
}

function buildStatusSnapshot(row: {
  status: string;
  visibilityStatus: string;
  isPublic: boolean;
  publishedAt: Date | null;
}) {
  return {
    status: row.status,
    visibilityStatus: row.visibilityStatus,
    isPublic: row.isPublic,
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

function getIntentFromFormData(formData: FormData): "save" | "publish" | null {
  const intent = String(formData.get("intent") ?? "").trim();
  if (intent === "save" || intent === "publish") {
    return intent;
  }
  return null;
}

function logActionStep(label: string, payload: Record<string, unknown>) {
  console.info(`[admin-project-edit] ${label}`, payload);
}

function validateIntent(intent: string): intent is "save" | "publish" {
  return intent === "save" || intent === "publish";
}

function summarizeInput(input: ParsedAdminProjectInput) {
  return {
    name: input.name,
    hasTagline: Boolean(input.tagline?.trim()),
    hasDescription: Boolean(input.description?.trim()),
    primaryCategory: input.primaryCategory,
    tagsCount: input.tags.length,
    hasWebsiteUrl: Boolean(input.websiteUrl),
    hasGithubUrl: Boolean(input.githubUrl),
    hasAiCardSummary: Boolean(input.aiCardSummary?.trim()),
    externalLinksCount: input.externalLinks.length,
  };
}

export async function saveAdminProject(
  _prev: AdminProjectEditFormState,
  formData: FormData,
): Promise<AdminProjectEditFormState> {
  try {
    await requireMuHubAdmin();
  } catch (error) {
    const message = error instanceof AdminAuthError ? error.message : "无权操作该项目。";
    return {
      ...initialFail,
      formError: message,
      toast: { kind: "error", message },
    };
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const rawIntent = getIntentFromFormData(formData) ?? "save";

  if (!validateIntent(rawIntent)) {
    return {
      ...initialFail,
      formError: `未知操作：${rawIntent || "empty"}`,
      toast: { kind: "error", message: "提交失败：无法识别当前操作。" },
    };
  }

  const intent = rawIntent;
  logActionStep("entered", { projectId, intent });

  if (!projectId) {
    return {
      ...initialFail,
      action: intent,
      formError: "缺少项目 ID，无法保存。",
      toast: { kind: "error", message: "提交失败：缺少项目 ID。" },
    };
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
    return {
      ...initialFail,
      action: intent,
      formError: "项目不存在或已删除。",
      toast: { kind: "error", message: "项目不存在或已删除。" },
    };
  }

  let parsed: ParsedAdminProjectInput;
  try {
    parsed = parseAdminProjectInput(formData);
    logActionStep("parsed", {
      projectId,
      intent,
      fields: summarizeInput(parsed),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "表单解析失败，请检查输入内容。";
    logActionStep("parse_failed", { projectId, intent, message });
    return {
      ...initialFail,
      action: intent,
      formError: message,
      toast: { kind: "error", message },
      statusSnapshot: buildStatusSnapshot(existing),
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
    const message = `发布失败：${publishValidation.blockingErrors.join("；")}`;
    logActionStep("publish_blocked", {
      projectId,
      intent,
      blockingErrors: publishValidation.blockingErrors,
      readinessMessages: publishValidation.readinessMessages,
    });
    return {
      ...initialFail,
      action: intent,
      formError: message,
      toast: { kind: "error", message },
      statusSnapshot: buildStatusSnapshot(existing),
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
          visibilityStatus:
            intent === "publish"
              ? "PUBLISHED"
              : existing.visibilityStatus === "PUBLISHED"
                ? "PUBLISHED"
                : "DRAFT",
          isPublic: intent === "publish" ? true : existing.isPublic,
          publishedAt:
            intent === "publish"
              ? existing.publishedAt ?? new Date()
              : existing.publishedAt,
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

    const updated = await prisma.project.findUniqueOrThrow({
      where: { id: existing.id },
      select: {
        status: true,
        visibilityStatus: true,
        isPublic: true,
        publishedAt: true,
      },
    });

    logActionStep("updated", {
      projectId,
      intent,
      nextStatus: updated.status,
      nextVisibilityStatus: updated.visibilityStatus,
      isPublic: updated.isPublic,
      publishedAt: updated.publishedAt?.toISOString() ?? null,
    });

    revalidateProjectPaths(existing.id, existing.slug);

    return {
      ok: true,
      action: intent,
      toast: {
        kind: "success",
        message: intent === "publish" ? "已发布项目" : "已保存草稿",
      },
      refreshedAt: new Date().toISOString(),
      redirectPath: intent === "publish" ? `/projects/${existing.slug}` : undefined,
      statusSnapshot: buildStatusSnapshot(updated),
    };
  } catch (error) {
    console.error("[saveAdminProject]", { projectId, intent, error });
    return {
      ...initialFail,
      action: intent,
      formError: intent === "publish" ? "发布失败，请稍后重试。" : "保存失败，请稍后重试。",
      toast: {
        kind: "error",
        message: intent === "publish" ? "发布失败，请稍后重试。" : "保存失败，请稍后重试。",
      },
      statusSnapshot: buildStatusSnapshot(existing),
    };
  }
}
