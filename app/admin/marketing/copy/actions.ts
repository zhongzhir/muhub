"use server";

import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { fetchMarketingProjectSnippet } from "@/lib/admin-marketing-context";
import { writeProjectActionLog } from "@/lib/project-action-log";

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
  const tags = project.tags.slice(0, 5).map((tag) => `#${tag}`).join(" ");
  const category = project.primaryCategory ? `「${project.primaryCategory}」` : "实用工具";
  const baseTagline = project.tagline || `一个聚焦 ${category} 的项目`;
  const link = project.websiteUrl || project.githubUrl || `/projects/${project.slug}`;

  if (template === "social") {
    return {
      oneLiner: `${project.name}：${baseTagline}，现在可快速了解并上手。`,
      plaza: `推荐 ${project.name} ｜${baseTagline} ｜${tags}`.replace(/\s+/g, " ").trim(),
      social: `刚发现 ${project.name}，${baseTagline}。${tags} ${link}`.replace(/\s+/g, " ").trim(),
    };
  }

  return {
    oneLiner: `${project.name}：${baseTagline}。`,
    plaza: `【${project.name}】${baseTagline} ${tags}`.trim(),
    social: `我在 MUHUB 发现了 ${project.name}，${baseTagline}。${tags} ${link}`.trim(),
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
