"use server";

import { Prisma, type ProjectStatus, type SocialPlatform } from "@prisma/client";
import { auth } from "@/auth";
import { canManageProject } from "@/lib/project-permissions";
import { parseSocialInput } from "@/lib/social-input";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";
import { isProjectCategory } from "@/lib/projects/project-categories";
import { parseProjectTags } from "@/lib/projects/project-tags";
import {
  createProjectActivity,
  detectMeaningfulProjectProfileChanges,
} from "@/lib/activity/project-activity-service";

export type UpdateProjectFormState = {
  ok: boolean;
  formError?: string;
  fieldErrors?: Partial<Record<string, string>>;
  redirectPath?: string;
};

const initialFail: UpdateProjectFormState = { ok: false };

const STATUSES: ProjectStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED"];

const SOCIAL_FIELDS: { platform: SocialPlatform; field: string }[] = [
  { platform: "WEIBO", field: "weibo" },
  { platform: "WECHAT_OFFICIAL", field: "wechat_official" },
  { platform: "DOUYIN", field: "douyin" },
  { platform: "XIAOHONGSHU", field: "xiaohongshu" },
];

export async function updateProject(
  _prev: UpdateProjectFormState,
  formData: FormData,
): Promise<UpdateProjectFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ...initialFail, formError: "请先登录后再编辑项目。" };
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return {
      ok: false,
      formError: "未配置 DATABASE_URL，无法保存。请在 .env 中配置 PostgreSQL 连接串。",
    };
  }

  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) {
    return { ...initialFail, formError: "无法定位当前项目，请从项目页重新进入编辑。" };
  }

  const existing = await prisma.project.findFirst({
    where: { slug, ...PROJECT_ACTIVE_FILTER },
    select: {
      id: true,
      createdById: true,
      claimedByUserId: true,
      name: true,
      tagline: true,
      description: true,
      githubUrl: true,
      websiteUrl: true,
      primaryCategory: true,
      tags: true,
    },
  });

  if (!existing) {
    return { ...initialFail, formError: "项目不存在或已被删除，请返回列表后重试。" };
  }

  if (!canManageProject(session.user.id, existing)) {
    return { ...initialFail, formError: "你没有权限编辑此项目。" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const tagsRaw = String(formData.get("tags") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "").trim();
  const isFeatured = String(formData.get("isFeatured") ?? "") === "on";
  const githubUrlRaw = String(formData.get("githubUrl") ?? "").trim();
  const websiteUrlRaw = String(formData.get("websiteUrl") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();

  const fieldErrors: Partial<Record<string, string>> = {};

  if (!name) {
    fieldErrors.name = "请填写项目名称";
  }

  if (!STATUSES.includes(statusRaw as ProjectStatus)) {
    fieldErrors.status = "请选择有效的项目状态";
  }

  let githubUrl: string | null = null;
  if (githubUrlRaw) {
    try {
      githubUrl = new URL(githubUrlRaw).href;
    } catch {
      fieldErrors.githubUrl = "GitHub 仓库链接格式不正确，请以 http:// 或 https:// 开头的完整地址";
    }
  }

  let websiteUrl: string | null = null;
  if (websiteUrlRaw) {
    try {
      websiteUrl = new URL(websiteUrlRaw).href;
    } catch {
      fieldErrors.websiteUrl = "官网链接格式不正确，请以 http:// 或 https:// 开头的完整地址";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ...initialFail, fieldErrors };
  }

  const status = statusRaw as ProjectStatus;
  const tags = parseProjectTags(tagsRaw);
  let primaryCategory: string | null = null;
  if (categoryRaw) {
    if (!isProjectCategory(categoryRaw)) {
      fieldErrors.category = "请选择有效分类";
    } else {
      primaryCategory = categoryRaw;
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ...initialFail, fieldErrors };
  }

  try {
    const before = {
      name: existing.name,
      tagline: existing.tagline,
      description: existing.description,
      githubUrl: existing.githubUrl,
      websiteUrl: existing.websiteUrl,
      primaryCategory: existing.primaryCategory,
      tags: existing.tags,
    };

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: existing.id },
        data: {
          name,
          tagline,
          description,
          tags,
          primaryCategory,
          isFeatured,
          githubUrl,
          websiteUrl,
          status,
        },
      });

      for (const { platform, field } of SOCIAL_FIELDS) {
        const raw = String(formData.get(field) ?? "");
        const parsed = parseSocialInput(raw);
        await tx.projectSocialAccount.deleteMany({
          where: { projectId: existing.id, platform },
        });
        if (parsed) {
          await tx.projectSocialAccount.create({
            data: {
              projectId: existing.id,
              platform,
              accountName: parsed.accountName,
              accountUrl: parsed.accountUrl,
            },
          });
        }
      }
    });

    const after = {
      name,
      tagline,
      description,
      githubUrl,
      websiteUrl,
      primaryCategory,
      tags,
    };
    const profileChanged = detectMeaningfulProjectProfileChanges({ before, after });
    if (profileChanged.changed) {
      await createProjectActivity({
        projectId: existing.id,
        type: "project_profile_updated",
        title: "项目资料已更新",
        summary: profileChanged.summary,
        sourceType: "project_edit",
        sourceUrl: `/projects/${slug}`,
        dedupeKey: profileChanged.dedupeKey,
        metadataJson: { changedBy: session.user.id },
      });
    }
  } catch (e) {
    console.error("[updateProject]", e);
    return {
      ...initialFail,
      formError:
        "保存失败，请稍后重试。若持续出现，请确认数据库可连接且迁移已应用。" +
        (e instanceof Prisma.PrismaClientKnownRequestError ? `（${e.code}）` : ""),
    };
  }

  return { ok: true, redirectPath: `/projects/${slug}` };
}
