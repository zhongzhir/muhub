"use server";

import { revalidatePath } from "next/cache";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { fetchMarketingProjectSnippet } from "@/lib/admin-marketing-context";
import { normalizeReferenceSources } from "@/lib/discovery/reference-sources";
import { writeProjectActionLog } from "@/lib/project-action-log";
import { prisma } from "@/lib/prisma";

type CopyTemplate = "general" | "social";

export type MarketingCopyActionState = {
  ok: boolean;
  message: string;
  template: CopyTemplate;
  output: {
    oneLiner: string;
    plaza: string;
    social: string;
  } | null;
};

export type WriteSummaryActionState = {
  ok: boolean;
  message: string;
};

const initialState: MarketingCopyActionState = {
  ok: false,
  message: "",
  template: "general",
  output: null,
};

function buildCopy(
  project: NonNullable<Awaited<ReturnType<typeof fetchMarketingProjectSnippet>>>,
  template: CopyTemplate,
) {
  const references = normalizeReferenceSources(project.referenceSources);
  const primaryReference = references.find((item) => item.isPrimary) ?? references[0];
  const topReference = primaryReference?.url ?? "";
  const topReferenceText =
    primaryReference?.summary?.trim() ||
    primaryReference?.title?.trim() ||
    "";
  const tags = project.tags.slice(0, 5).map((tag) => `#${tag}`).join(" ");
  const category = project.primaryCategory ? `「${project.primaryCategory}」` : "实用工具";
  const baseTagline =
    project.simpleSummary?.trim() ||
    project.tagline ||
    `一个聚焦 ${category} 的项目`;
  const link = project.websiteUrl || project.githubUrl || `/projects/${project.slug}`;

  if (template === "social") {
    return {
      oneLiner: `${project.name}：${baseTagline}${topReferenceText ? `（参考：${topReferenceText}）` : ""}，现在可快速了解并上手。`,
      plaza: `推荐 ${project.name} ｜${baseTagline} ｜${tags}`.replace(/\s+/g, " ").trim(),
      social: `刚发现 ${project.name}，${baseTagline}。${tags} ${link}${topReference ? ` 参考：${topReference}` : ""}`.replace(/\s+/g, " ").trim(),
    };
  }

  return {
    oneLiner: `${project.name}：${baseTagline}${topReferenceText ? `（参考：${topReferenceText}）` : ""}。`,
    plaza: `【${project.name}】${baseTagline} ${tags}${topReference ? ` · 参考：${topReference}` : ""}`.trim(),
    social: `我在 MUHUB 发现了 ${project.name}，${baseTagline}。${tags} ${link}${topReference ? ` 参考：${topReference}` : ""}`.trim(),
  };
}

export async function generateMarketingCopyAction(
  _prev: MarketingCopyActionState,
  formData: FormData,
): Promise<MarketingCopyActionState> {
  try {
    await requireMuHubAdmin();
  } catch (error) {
    const message = error instanceof AdminAuthError ? error.message : "无权生成文案。";
    return { ...initialState, message };
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const templateRaw = String(formData.get("template") ?? "general").trim();
  const template: CopyTemplate = templateRaw === "social" ? "social" : "general";
  if (!projectId) {
    return { ...initialState, message: "缺少 projectId。", template };
  }

  const project = await fetchMarketingProjectSnippet(projectId);
  if (!project) {
    return { ...initialState, message: "项目不存在或已删除。", template };
  }

  const output = buildCopy(project, template);
  await writeProjectActionLog({
    projectId: project.id,
    action: "marketing_generate",
    detail: `生成文案 template=${template}`,
  });

  return {
    ok: true,
    message: "文案已生成。",
    template,
    output,
  };
}

export async function writeSimpleSummaryFromCopyAction(
  _prev: WriteSummaryActionState,
  formData: FormData,
): Promise<WriteSummaryActionState> {
  try {
    await requireMuHubAdmin();
  } catch (error) {
    const message = error instanceof AdminAuthError ? error.message : "无权写入项目通俗介绍。";
    return { ok: false, message };
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  if (!projectId) {
    return { ok: false, message: "缺少 projectId。" };
  }
  if (!summary) {
    return { ok: false, message: "写入内容为空。" };
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!project) {
    return { ok: false, message: "项目不存在或已删除。" };
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { simpleSummary: summary.slice(0, 200) },
  });
  await writeProjectActionLog({
    projectId: project.id,
    action: "marketing_generate",
    detail: "营销文案页回填通俗介绍",
  });

  revalidatePath(`/admin/projects/${project.id}/edit`);
  revalidatePath(`/projects/${project.slug}`);

  return { ok: true, message: "已写入项目通俗介绍。请按需到编辑页继续调整。" };
}
