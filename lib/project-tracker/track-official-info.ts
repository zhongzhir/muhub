import { Prisma, ProjectSourceKind } from "@prisma/client";

import { PROJECT_PLAZA_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";

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

export type TrackOfficialInfoResult = {
  examined: number;
  updated: number;
  skipped: number;
  errors: string[];
  gaps: OfficialInfoGap[];
};

type ProjectTrackResult = {
  updated: boolean;
  newSources: string[];
  error?: string;
};

type OfficialInfoAiResult = {
  websiteUrl: string | null;
  wechatAccount: string | null;
  weiboUrl: string | null;
  douyinUrl: string | null;
  appStoreUrl: string | null;
  playStoreUrl: string | null;
};

type AiEnrichmentResult =
  | { ok: true; data: OfficialInfoAiResult }
  | { ok: false; error: string };

function asHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function aiEnrichOfficialInfo(input: {
  name: string;
  description: string | null;
  existingWebsite: string | null;
  existingGithub: string | null;
  category: string | null;
}): Promise<AiEnrichmentResult> {
  try {
    const { generateText } = await import("@/lib/ai/generate-text");
    const existingInfo = [
      input.existingWebsite ? `website: ${input.existingWebsite}` : null,
      input.existingGithub ? `GitHub: ${input.existingGithub}` : null,
      input.category ? `category: ${input.category}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `You are helping maintain MUHUB project pages.
Infer official project information from the known facts below. This is not a web search. Only return fields you are confident about, and use null when uncertain.

Project name: ${input.name}
Project description: ${input.description || "none"}
${existingInfo ? `Known facts:\n${existingInfo}` : ""}

Return JSON only with this exact shape:
{"websiteUrl":null,"wechatAccount":null,"weiboUrl":null,"douyinUrl":null,"appStoreUrl":null,"playStoreUrl":null}

Rules:
- websiteUrl, weiboUrl, douyinUrl, appStoreUrl, and playStoreUrl must be official URLs or null.
- wechatAccount must be the official account name, not a URL.
- Do not invent links. If confidence is low, return null.`;

    const raw = await generateText(prompt, {
      maxTokens: 300,
      temperature: 0.1,
      systemPrompt:
        "Return strict JSON only. Prefer null over an uncertain or unofficial source.",
    });

    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonStr) {
      return { ok: false, error: "AI returned no JSON object" };
    }

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    return {
      ok: true,
      data: {
        websiteUrl: asHttpUrl(parsed.websiteUrl),
        wechatAccount: asNonEmptyString(parsed.wechatAccount),
        weiboUrl: asHttpUrl(parsed.weiboUrl),
        douyinUrl: asHttpUrl(parsed.douyinUrl),
        appStoreUrl: asHttpUrl(parsed.appStoreUrl),
        playStoreUrl: asHttpUrl(parsed.playStoreUrl),
      },
    };
  } catch (err) {
    return { ok: false, error: normalizeError(err) };
  }
}

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
        select: { kind: true, url: true },
      },
    },
  });

  if (!project) {
    return { updated: false, newSources: [], error: "project not found" };
  }

  const existingKinds = new Set(project.sources.map((source) => source.kind));
  const hasWechat = existingKinds.has("WECHAT");
  const hasWeibo = project.sources.some((source) => source.url?.includes("weibo.com"));
  const hasDouyin = existingKinds.has("DOUYIN");
  const hasAppStore = project.sources.some((source) => source.url?.includes("apps.apple.com"));
  const hasPlayStore = project.sources.some((source) =>
    source.url?.includes("play.google.com"),
  );

  const hasEnoughSources =
    Boolean(project.websiteUrl || project.githubUrl) && (hasWechat || hasWeibo || hasDouyin);
  if (hasEnoughSources) {
    return { updated: false, newSources: [] };
  }

  const aiResult = await aiEnrichOfficialInfo({
    name: project.name,
    description: project.description || project.tagline || null,
    existingWebsite: project.websiteUrl || null,
    existingGithub: project.githubUrl || null,
    category: Array.isArray(project.categoriesJson)
      ? (project.categoriesJson as string[])[0] || null
      : null,
  });

  if (!aiResult.ok) {
    return { updated: false, newSources: [], error: `AI enrichment failed: ${aiResult.error}` };
  }

  const newSources: string[] = [];
  const sourceUpserts: Array<{ kind: "WECHAT" | "DOUYIN" | "OTHER"; url: string; label: string }> =
    [];

  if (aiResult.data.websiteUrl && !project.websiteUrl) {
    await prisma.project.update({
      where: { id: projectId },
      data: { websiteUrl: aiResult.data.websiteUrl },
    });
    newSources.push(`website: ${aiResult.data.websiteUrl}`);
  }

  if (aiResult.data.wechatAccount && !hasWechat) {
    sourceUpserts.push({
      kind: "WECHAT",
      url: `wechat://account/${aiResult.data.wechatAccount}`,
      label: aiResult.data.wechatAccount,
    });
    newSources.push(`wechat: ${aiResult.data.wechatAccount}`);
  }

  if (aiResult.data.weiboUrl && !hasWeibo) {
    sourceUpserts.push({ kind: "OTHER", url: aiResult.data.weiboUrl, label: "Weibo" });
    newSources.push(`weibo: ${aiResult.data.weiboUrl}`);
  }

  if (aiResult.data.douyinUrl && !hasDouyin) {
    sourceUpserts.push({ kind: "DOUYIN", url: aiResult.data.douyinUrl, label: "Douyin" });
    newSources.push(`douyin: ${aiResult.data.douyinUrl}`);
  }

  if (aiResult.data.appStoreUrl && !hasAppStore) {
    sourceUpserts.push({ kind: "OTHER", url: aiResult.data.appStoreUrl, label: "App Store" });
    newSources.push(`app-store: ${aiResult.data.appStoreUrl}`);
  }

  if (aiResult.data.playStoreUrl && !hasPlayStore) {
    sourceUpserts.push({
      kind: "OTHER",
      url: aiResult.data.playStoreUrl,
      label: "Google Play",
    });
    newSources.push(`google-play: ${aiResult.data.playStoreUrl}`);
  }

  for (const source of sourceUpserts) {
    const existing = await prisma.projectSource.findFirst({
      where: { projectId, url: source.url },
    });
    if (!existing) {
      await prisma.projectSource.create({
        data: {
          projectId,
          kind: source.kind,
          url: source.url,
          label: source.label,
        },
      });
    }
  }

  if (newSources.length === 0) {
    return { updated: false, newSources: [] };
  }

  try {
    await prisma.projectUpdate.create({
      data: {
        projectId,
        sourceType: "SYSTEM",
        isAiGenerated: true,
        title: "官方信息来源已补全",
        summary: `系统补全了 ${newSources.length} 个官方信息来源。`,
        content: `系统补全了以下官方信息来源：\n${newSources.join("\n")}`,
      },
    });
  } catch (err) {
    return {
      updated: true,
      newSources,
      error: `source updated but ProjectUpdate write failed: ${normalizeError(err)}`,
    };
  }

  return { updated: true, newSources };
}

export async function trackAllProjectsOfficialInfo(options?: {
  limit?: number;
  onlyMissingSource?: boolean;
  spacingMs?: number;
}): Promise<TrackOfficialInfoResult> {
  const limit = options?.limit ?? 50;
  const onlyMissingSource = options?.onlyMissingSource ?? true;
  const spacingMs = options?.spacingMs ?? 500;

  const sourceKindsToCheck: ProjectSourceKind[] = ["WECHAT", "DOUYIN"];
  const whereClause: Prisma.ProjectWhereInput = onlyMissingSource
    ? {
        ...PROJECT_PLAZA_FILTER,
        OR: [
          { websiteUrl: null },
          { sources: { none: { kind: { in: sourceKindsToCheck } } } },
        ],
      }
    : PROJECT_PLAZA_FILTER;

  const projects = await prisma.project.findMany({
    where: whereClause,
    select: { id: true, slug: true, name: true },
    orderBy: { updatedAt: "asc" },
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
      const projectDetail = await prisma.project.findUnique({
        where: { id: project.id },
        select: {
          websiteUrl: true,
          githubUrl: true,
          sources: { select: { kind: true, url: true } },
        },
      });

      if (!projectDetail) {
        result.skipped += 1;
        result.errors.push(`[${project.slug}] project detail not found`);
        continue;
      }

      const existingKinds = new Set(projectDetail.sources.map((source) => source.kind));
      const gap: OfficialInfoGap = {
        projectId: project.id,
        slug: project.slug,
        name: project.name,
        missingFields: [],
        hasWebsite: Boolean(projectDetail.websiteUrl),
        hasGithub: Boolean(projectDetail.githubUrl),
        hasWechat: existingKinds.has("WECHAT"),
        hasWeibo: projectDetail.sources.some((source) => source.url?.includes("weibo.com")),
        hasDouyin: existingKinds.has("DOUYIN"),
        hasAppStore: projectDetail.sources.some((source) =>
          source.url?.includes("apps.apple.com"),
        ),
      };

      if (!gap.hasWebsite) gap.missingFields.push("website");
      if (!gap.hasGithub) gap.missingFields.push("GitHub");
      if (!gap.hasWechat) gap.missingFields.push("WeChat");
      if (!gap.hasWeibo) gap.missingFields.push("Weibo");
      if (!gap.hasDouyin) gap.missingFields.push("Douyin");
      if (gap.missingFields.length > 0) result.gaps.push(gap);

      const trackResult = await trackProjectOfficialInfo(project.id);
      if (trackResult.updated) {
        result.updated += 1;
        console.log(
          `[tracker:official-info] updated ${project.slug}: ${trackResult.newSources.join(", ")}`,
        );
      } else {
        result.skipped += 1;
      }

      if (trackResult.error) {
        result.errors.push(`[${project.slug}] ${trackResult.error}`);
      }

      if (spacingMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, spacingMs));
      }
    } catch (err) {
      result.errors.push(`[${project.slug}] ${normalizeError(err)}`);
      result.skipped += 1;
    }
  }

  return result;
}
