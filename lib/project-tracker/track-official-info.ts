/**
 * 周期性全网项目信息追踪模块
 *
 * 功能：
 * 1. 遍历已上架项目，检查官方信息来源的完整度
 * 2. 通过 AI 对缺失的字段进行全网信息补全（官网、公众号、微博、抖音、App Store 等）
 * 3. 发现新动态时写入 ProjectUpdate 并可触发发布/审核流程
 *
 * 运行方式：
 * - 手动触发：pnpm run tracker:official-info
 * - 定时任务：通过 cron 或外部调度（建议每周或每两周一次）
 */

import { prisma } from "@/lib/prisma";
import { PROJECT_PLAZA_FILTER } from "@/lib/project-active-filter";

/** 官方信息来源完整度检查结果 */
export type OfficialInfoGap = {
  projectId: string;
  slug: string;
  name: string;
  missingFields: string[];
  hasWebsite: boolean;
  hasGithub: boolean;
  hasWechat: boolean;
  hasWeibo: boolean;
  hasDouyin: boolean;
  hasAppStore: boolean;
};

/** 追踪运行结果统计 */
export type TrackOfficialInfoResult = {
  examined: number;
  updated: number;
  skipped: number;
  errors: string[];
  gaps: OfficialInfoGap[];
};

/** 单个项目的追踪更新结果 */
type ProjectTrackResult = {
  updated: boolean;
  newSources: string[];
  error?: string;
};

/**
 * 从 AI 补全指定项目的官方信息来源。
 * 通过项目名称和现有信息进行全网信息推断。
 */
async function aiEnrichOfficialInfo(input: {
  name: string;
  description: string | null;
  existingWebsite: string | null;
  existingGithub: string | null;
  category: string | null;
}): Promise<{
  websiteUrl: string | null;
  wechatAccount: string | null;
  weiboUrl: string | null;
  douyinUrl: string | null;
  appStoreUrl: string | null;
  playStoreUrl: string | null;
} | null> {
  try {
    const { generateText } = await import("@/lib/ai/generate-text");
    const existingInfo = [
      input.existingWebsite ? `官网：${input.existingWebsite}` : null,
      input.existingGithub ? `GitHub：${input.existingGithub}` : null,
      input.category ? `分类：${input.category}` : null,
    ].filter(Boolean).join("\n");

    const prompt = `你是一个项目官方信息查找助手。根据以下项目信息，尝试推断或补全其官方信息来源链接。

项目名称：${input.name}
项目简介：${input.description || "无"}
${existingInfo ? `已知信息：\n${existingInfo}` : ""}

请尝试推断以下官方信息来源（只填写你有较高把握的，不确定的填 null，绝对不要编造链接）：
- websiteUrl：项目官网 URL（字符串或 null）
- wechatAccount：微信公众号名称（字符串或 null，不是链接，是名称）
- weiboUrl：微博账号主页 URL（字符串或 null）
- douyinUrl：抖音主页 URL（字符串或 null）
- appStoreUrl：App Store 链接（字符串或 null）
- playStoreUrl：Google Play 链接（字符串或 null）

注意：
1. 只填写官方账号/链接，不填第三方介绍页
2. 不确定的字段必须填 null，宁缺勿滥
3. 只返回 JSON，格式如下：
{"websiteUrl":null,"wechatAccount":null,"weiboUrl":null,"douyinUrl":null,"appStoreUrl":null,"playStoreUrl":null}`;

    const raw = await generateText(prompt, {
      maxTokens: 300,
      temperature: 0.1,
      systemPrompt: "你是项目信息查找专家，只返回 JSON，不要其他内容。对不确定的信息填 null。",
    });

    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonStr) return null;
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    return {
      websiteUrl: typeof parsed.websiteUrl === "string" && parsed.websiteUrl.startsWith("http") ? parsed.websiteUrl.trim() : null,
      wechatAccount: typeof parsed.wechatAccount === "string" && parsed.wechatAccount.trim() ? parsed.wechatAccount.trim() : null,
      weiboUrl: typeof parsed.weiboUrl === "string" && parsed.weiboUrl.startsWith("http") ? parsed.weiboUrl.trim() : null,
      douyinUrl: typeof parsed.douyinUrl === "string" && parsed.douyinUrl.startsWith("http") ? parsed.douyinUrl.trim() : null,
      appStoreUrl: typeof parsed.appStoreUrl === "string" && parsed.appStoreUrl.startsWith("http") ? parsed.appStoreUrl.trim() : null,
      playStoreUrl: typeof parsed.playStoreUrl === "string" && parsed.playStoreUrl.startsWith("http") ? parsed.playStoreUrl.trim() : null,
    };
  } catch {
    return null;
  }
}

/**
 * 检查单个项目的官方信息完整度，必要时进行 AI 补全。
 */
async function trackProjectOfficialInfo(projectId: string): Promise<ProjectTrackResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      description: true,
      githubUrl: true,
      websiteUrl: true,
      categoriesJson: true,
      sources: {
        select: { kind: true, url: true, label: true },
      },
    },
  });

  if (!project) {
    return { updated: false, newSources: [], error: "项目不存在" };
  }

  // 检查现有来源
  const existingKinds = new Set(project.sources.map((s) => s.kind));
  const hasWechat = existingKinds.has("WECHAT");
  const hasWeibo = existingKinds.has("WEIBO" as never) || project.sources.some(s => s.url?.includes("weibo.com"));
  const hasDouyin = existingKinds.has("DOUYIN");
  const hasAppStore = project.sources.some(s => s.url?.includes("apps.apple.com"));
  const hasPlayStore = project.sources.some(s => s.url?.includes("play.google.com"));

  const missingFields = [];
  if (!project.websiteUrl) missingFields.push("官网");
  if (!project.githubUrl) missingFields.push("GitHub");
  if (!hasWechat) missingFields.push("公众号");
  if (!hasWeibo) missingFields.push("微博");
  if (!hasDouyin) missingFields.push("抖音");

  // 如果关键来源都有，跳过
  const hasEnoughSources = (project.websiteUrl || project.githubUrl) && (hasWechat || hasWeibo || hasDouyin);
  if (hasEnoughSources) {
    return { updated: false, newSources: [], error: undefined };
  }

  // 尝试 AI 补全缺失字段
  const aiResult = await aiEnrichOfficialInfo({
    name: project.name,
    description: project.description || project.tagline || null,
    existingWebsite: project.websiteUrl || null,
    existingGithub: project.githubUrl || null,
    category: Array.isArray(project.categoriesJson) ? (project.categoriesJson as string[])[0] || null : null,
  });

  if (!aiResult) {
    return { updated: false, newSources: [] };
  }

  const newSources: string[] = [];
  const sourceUpserts: Array<{ kind: string; url: string; label: string }> = [];

  // 官网
  if (aiResult.websiteUrl && !project.websiteUrl) {
    await prisma.project.update({
      where: { id: projectId },
      data: { websiteUrl: aiResult.websiteUrl },
    });
    newSources.push(`官网: ${aiResult.websiteUrl}`);
  }

  // 微信公众号
  if (aiResult.wechatAccount && !hasWechat) {
    sourceUpserts.push({ kind: "WECHAT", url: `wechat://account/${aiResult.wechatAccount}`, label: aiResult.wechatAccount });
    newSources.push(`公众号: ${aiResult.wechatAccount}`);
  }

  // 微博
  if (aiResult.weiboUrl && !hasWeibo) {
    sourceUpserts.push({ kind: "OTHER", url: aiResult.weiboUrl, label: "微博" });
    newSources.push(`微博: ${aiResult.weiboUrl}`);
  }

  // 抖音
  if (aiResult.douyinUrl && !hasDouyin) {
    sourceUpserts.push({ kind: "DOUYIN", url: aiResult.douyinUrl, label: "抖音" });
    newSources.push(`抖音: ${aiResult.douyinUrl}`);
  }

  // App Store
  if (aiResult.appStoreUrl && !hasAppStore) {
    sourceUpserts.push({ kind: "OTHER", url: aiResult.appStoreUrl, label: "App Store" });
    newSources.push(`App Store: ${aiResult.appStoreUrl}`);
  }

  // Google Play
  if (aiResult.playStoreUrl && !hasPlayStore) {
    sourceUpserts.push({ kind: "OTHER", url: aiResult.playStoreUrl, label: "Google Play" });
    newSources.push(`Google Play: ${aiResult.playStoreUrl}`);
  }

  // 写入新来源（先检查是否已存在相同 url）
  for (const s of sourceUpserts) {
    const existing = await prisma.projectSource.findFirst({
      where: { projectId, url: s.url },
    });
    if (!existing) {
      await prisma.projectSource.create({
        data: { projectId, kind: s.kind as never, url: s.url, label: s.label },
      });
    }
  }

  // 若有新来源，写入一条系统动态记录（AI 生成，标记为信息补全）
  if (newSources.length > 0) {
    try {
      await prisma.projectUpdate.create({
        data: {
          projectId,
          sourceType: "SYSTEM",
          isAiGenerated: true,
          title: "官方信息来源已补全",
          summary: `系统自动发现并补全了 ${newSources.length} 个官方信息来源`,
          content: `系统自动补全了以下官方信息来源：\n${newSources.join("\n")}`,
        },
      });
    } catch {
      // 写入动态失败不影响来源更新
    }

    return { updated: true, newSources };
  }

  return { updated: false, newSources: [] };
}

/**
 * 对所有已上架项目进行官方信息来源追踪和补全。
 *
 * @param options.limit 单次最多处理项目数（默认 50）
 * @param options.onlyMissingSource 只处理缺少官方来源的项目（默认 true）
 * @param options.spacingMs 项目间隔时间（毫秒，避免 API 速率限制，默认 500）
 */
export async function trackAllProjectsOfficialInfo(options?: {
  limit?: number;
  onlyMissingSource?: boolean;
  spacingMs?: number;
}): Promise<TrackOfficialInfoResult> {
  const limit = options?.limit ?? 50;
  const onlyMissingSource = options?.onlyMissingSource ?? true;
  const spacingMs = options?.spacingMs ?? 500;

  const whereClause = onlyMissingSource
    ? {
        ...PROJECT_PLAZA_FILTER,
        OR: [
          { websiteUrl: null },
          { sources: { none: { kind: { in: ["WECHAT", "DOUYIN"] as never[] } } } },
        ],
      }
    : PROJECT_PLAZA_FILTER;

  const projects = await prisma.project.findMany({
    where: whereClause,
    select: { id: true, slug: true, name: true },
    orderBy: { updatedAt: "asc" }, // 优先处理最久未更新的
    take: limit,
  });

  const result: TrackOfficialInfoResult = {
    examined: projects.length,
    updated: 0,
    skipped: 0,
    errors: [],
    gaps: [],
  };

  for (const project of projects) {
    try {
      // 检查官方信息完整度
      const projectDetail = await prisma.project.findUnique({
        where: { id: project.id },
        select: {
          websiteUrl: true,
          githubUrl: true,
          sources: { select: { kind: true, url: true } },
        },
      });

      if (!projectDetail) { result.skipped += 1; continue; }

      const existingKinds = new Set(projectDetail.sources.map((s) => s.kind));
      const gap: OfficialInfoGap = {
        projectId: project.id,
        slug: project.slug,
        name: project.name,
        missingFields: [],
        hasWebsite: !!projectDetail.websiteUrl,
        hasGithub: !!projectDetail.githubUrl,
        hasWechat: existingKinds.has("WECHAT"),
        hasWeibo: projectDetail.sources.some(s => s.url?.includes("weibo.com")),
        hasDouyin: existingKinds.has("DOUYIN"),
        hasAppStore: projectDetail.sources.some(s => s.url?.includes("apps.apple.com")),
      };
      if (!gap.hasWebsite) gap.missingFields.push("官网");
      if (!gap.hasGithub) gap.missingFields.push("GitHub");
      if (!gap.hasWechat) gap.missingFields.push("公众号");
      if (!gap.hasWeibo) gap.missingFields.push("微博");
      if (!gap.hasDouyin) gap.missingFields.push("抖音");
      if (gap.missingFields.length > 0) result.gaps.push(gap);

      const trackResult = await trackProjectOfficialInfo(project.id);
      if (trackResult.error) {
        result.errors.push(`[${project.slug}] ${trackResult.error}`);
        result.skipped += 1;
      } else if (trackResult.updated) {
        result.updated += 1;
        console.log(`[tracker] ✓ ${project.slug}: 新增来源 ${trackResult.newSources.join(", ")}`);
      } else {
        result.skipped += 1;
      }

      // 间隔等待，避免 AI API 限流
      if (spacingMs > 0) {
        await new Promise((r) => setTimeout(r, spacingMs));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`[${project.slug}] ${msg}`);
      result.skipped += 1;
    }
  }

  return result;
}
