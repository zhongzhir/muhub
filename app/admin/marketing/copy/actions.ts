"use server";

import { revalidatePath } from "next/cache";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { fetchMarketingProjectSnippet } from "@/lib/admin-marketing-context";
import {
  buildProjectContentSourceSnapshot,
  generateProjectAIContent,
  saveProjectAIContent,
  type ProjectAIContent,
} from "@/lib/project-ai-content";
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
    mode: "balanced" | "expressive";
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

function asContent(value: unknown): ProjectAIContent | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  if (!obj.copy || typeof obj.copy !== "object") return null;
  return value as ProjectAIContent;
}

function buildCopy(
  project: NonNullable<Awaited<ReturnType<typeof fetchMarketingProjectSnippet>>>,
  content: ProjectAIContent,
  template: CopyTemplate,
) {
  const tags = project.tags.slice(0, 5).map((tag) => `#${tag}`).join(" ");
  const link = project.websiteUrl || project.githubUrl || `/projects/${project.slug}`;
  const mode: "balanced" | "expressive" =
    content.mode === "expressive" ? "expressive" : "balanced";
  const oneLiner = content.copy.oneLiner || `${project.name}：${project.simpleSummary || project.tagline || "信息不足"}`;
  const medium = content.copy.medium || content.copy.short || oneLiner;
  const short = content.copy.short || oneLiner;
  const socialBase = template === "social" ? (content.copy.audienceVersions?.creator || short) : short;

  return {
    oneLiner,
    plaza: `【${project.name}】${medium} ${tags}`.replace(/\s+/g, " ").trim(),
    social: `${socialBase} ${tags} ${link}`.replace(/\s+/g, " ").trim(),
    mode,
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

  let content = asContent(project.aiContent);
  if (!content) {
    const snapshot = await buildProjectContentSourceSnapshot(project.id);
    if (!snapshot) {
      return { ...initialState, message: "项目不存在或已删除。", template };
    }
    const generated = await generateProjectAIContent(snapshot, { mode: "balanced" });
    await saveProjectAIContent(project.id, { content: generated });
    await prisma.project.update({
      where: { id: project.id },
      data: {
        aiContentDraft: generated,
      },
    });
    content = generated;
  }

  const output = buildCopy(project, content, template);
  await writeProjectActionLog({
    projectId: project.id,
    action: "marketing_generate",
    detail: `生成文案 template=${template} mode=${output.mode}`,
  });

  return {
    ok: true,
    message: "文案已基于 AI Content 生成。",
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
