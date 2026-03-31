"use server";

import { Prisma, type ProjectStatus, type SocialPlatform } from "@prisma/client";
import { auth } from "@/auth";
import { canManageProject } from "@/lib/project-permissions";
import { parseSocialInput } from "@/lib/social-input";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";

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
    select: { id: true, createdById: true, claimedByUserId: true },
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

  const isPublic = formData.get("isPublic") === "true";
  const status = statusRaw as ProjectStatus;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: existing.id },
        data: {
          name,
          tagline,
          description,
          githubUrl,
          websiteUrl,
          isPublic,
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
