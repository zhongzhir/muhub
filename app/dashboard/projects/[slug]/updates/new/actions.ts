"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canManageProject } from "@/lib/project-permissions";
import { prisma } from "@/lib/prisma";
import { normalizeProjectSlugParam } from "@/lib/route-slug";

export type PublishProjectUpdateFormState = {
  ok: boolean;
  formError?: string;
  fieldErrors?: Partial<Record<string, string>>;
  redirectPath?: string;
};

const initialFail: PublishProjectUpdateFormState = { ok: false };

export async function publishProjectUpdate(
  _prev: PublishProjectUpdateFormState,
  formData: FormData,
): Promise<PublishProjectUpdateFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ...initialFail, formError: "请先登录后再发布动态。" };
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return {
      ok: false,
      formError: "未配置 DATABASE_URL，无法写入数据库。请在 .env 中配置 PostgreSQL 连接串并执行迁移。",
    };
  }

  const slug = normalizeProjectSlugParam(String(formData.get("slug") ?? ""));
  if (!slug) {
    return { ...initialFail, formError: "无法定位当前项目，请从项目页重新进入发布动态。" };
  }

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, createdById: true, claimedByUserId: true },
  });

  if (!project) {
    return { ...initialFail, formError: "项目不存在或已被删除，请返回后重试。" };
  }

  if (!canManageProject(session.user.id, project)) {
    return { ...initialFail, formError: "你没有权限为此项目发布动态。" };
  }

  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  const fieldErrors: Partial<Record<string, string>> = {};
  if (!title) {
    fieldErrors.title = "请填写标题";
  }
  if (!content) {
    fieldErrors.content = "请填写内容";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ...initialFail, fieldErrors };
  }

  try {
    await prisma.projectUpdate.create({
      data: {
        projectId: project.id,
        sourceType: "MANUAL",
        sourceLabel: "手动发布",
        title,
        content,
        isAiGenerated: false,
      },
    });
    revalidatePath(`/projects/${slug}`, "page");
  } catch (e) {
    console.error("[publishProjectUpdate]", e);
    return {
      ...initialFail,
      formError:
        "发布失败，请稍后重试。若持续出现，请确认数据库可连接且迁移已应用（含 ProjectUpdate 多源字段如 sourceLabel / isAiGenerated）。",
    };
  }

  return { ok: true, redirectPath: `/projects/${slug}` };
}
