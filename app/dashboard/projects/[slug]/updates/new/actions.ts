"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export type PublishProjectUpdateFormState = {
  ok: boolean;
  formError?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

const initialFail: PublishProjectUpdateFormState = { ok: false };

export async function publishProjectUpdate(
  _prev: PublishProjectUpdateFormState,
  formData: FormData,
): Promise<PublishProjectUpdateFormState> {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      ok: false,
      formError: "未配置 DATABASE_URL，无法写入数据库。请在 .env 中配置 PostgreSQL 连接串并执行迁移。",
    };
  }

  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) {
    return { ...initialFail, formError: "缺少 slug，无法定位项目。" };
  }

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!project) {
    return { ...initialFail, formError: "项目不存在或已被删除，请返回后重试。" };
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
        title,
        content,
      },
    });
  } catch (e) {
    console.error("[publishProjectUpdate]", e);
    return {
      ...initialFail,
      formError: "发布失败，请稍后重试。若持续出现，请确认数据库可连接且迁移已应用（含 ProjectUpdate.content）。",
    };
  }

  redirect(`/projects/${slug}`);
}
