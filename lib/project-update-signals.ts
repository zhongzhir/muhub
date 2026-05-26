import type { ProjectUpdateSourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProjectEvidenceSnapshot } from "@/lib/project-evidence-snapshot";

export type ProjectUpdateSignalType =
  | "github_star_growth"
  | "github_last_commit"
  | "github_release"
  | "website_title_change"
  | "website_description_change"
  | "new_project_source";

export type ProjectUpdateSignal = {
  type: ProjectUpdateSignalType;
  summary: string;
  detectedAt: string;
};

function parseMetaJson(raw: string | null): Record<string, unknown> | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function persistSignal(
  projectId: string,
  signal: ProjectUpdateSignal,
  sourceType: ProjectUpdateSourceType,
  sourceUrl?: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  const dedupeKey = `${signal.type}:${signal.summary.slice(0, 120)}`;
  const recent = await prisma.projectUpdate.findFirst({
    where: {
      projectId,
      title: signal.type,
      summary: signal.summary,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
    },
    select: { id: true },
  });
  if (recent) {
    return;
  }
  await prisma.projectUpdate.create({
    data: {
      projectId,
      sourceType,
      sourceLabel: "evidence_signal",
      title: signal.type,
      summary: signal.summary,
      sourceUrl: sourceUrl ?? null,
      occurredAt: new Date(signal.detectedAt),
      isAiGenerated: false,
      metaJson: JSON.stringify({ dedupeKey, ...meta }),
    },
  });
}

export async function detectAndPersistProjectUpdateSignals(
  projectId: string,
  snapshot: ProjectEvidenceSnapshot,
): Promise<ProjectUpdateSignal[]> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { createdAt: true },
  });
  if (!project) {
    return [];
  }
  const isFreshProject = Date.now() - project.createdAt.getTime() < 3 * 60 * 1000;
  const detectedAt = snapshot.generatedAt;
  const signals: ProjectUpdateSignal[] = [];

  const prevGithub = await prisma.githubRepoSnapshot.findFirst({
    where: { projectId },
    orderBy: { fetchedAt: "desc" },
    select: {
      stars: true,
      lastCommitAt: true,
      latestReleaseTag: true,
      fetchedAt: true,
    },
  });

  if (snapshot.github.url && snapshot.github.stars != null) {
    if (prevGithub && !isFreshProject) {
      if (snapshot.github.stars > prevGithub.stars) {
        const delta = snapshot.github.stars - prevGithub.stars;
        signals.push({
          type: "github_star_growth",
          summary: `GitHub stars 从 ${prevGithub.stars} 增至 ${snapshot.github.stars}（+${delta}）`,
          detectedAt,
        });
      }
      const prevCommit = prevGithub.lastCommitAt?.toISOString() ?? null;
      const nextCommit = snapshot.github.updatedAt;
      if (nextCommit && prevCommit && nextCommit !== prevCommit) {
        signals.push({
          type: "github_last_commit",
          summary: `GitHub 最近提交时间更新为 ${nextCommit}`,
          detectedAt,
        });
      }
      if (
        typeof snapshot.github.releaseCount === "number" &&
        snapshot.github.releaseCount > 0 &&
        !prevGithub.latestReleaseTag
      ) {
        signals.push({
          type: "github_release",
          summary: `GitHub 仓库检测到 ${snapshot.github.releaseCount} 个 release`,
          detectedAt,
        });
      }
    }
  }

  const prevWebsiteUpdate = await prisma.projectUpdate.findFirst({
    where: { projectId, sourceType: "WEBSITE", title: "website_evidence_baseline" },
    orderBy: { createdAt: "desc" },
    select: { metaJson: true, createdAt: true },
  });
  const prevWebsiteMeta = parseMetaJson(prevWebsiteUpdate?.metaJson ?? null);
  const currentTitle = snapshot.website.title ?? "";
  const currentDescription = snapshot.website.description ?? "";
  if (snapshot.website.url && snapshot.website.reachable) {
    const prevTitle = typeof prevWebsiteMeta?.title === "string" ? prevWebsiteMeta.title : null;
    const prevDescription =
      typeof prevWebsiteMeta?.description === "string" ? prevWebsiteMeta.description : null;
    if (!prevWebsiteUpdate) {
      await persistSignal(
        projectId,
        {
          type: "website_title_change",
          summary: "已记录官网 evidence 基线",
          detectedAt,
        },
        "WEBSITE",
        snapshot.website.url,
        { title: currentTitle, description: currentDescription, baseline: true },
      );
      await prisma.projectUpdate.updateMany({
        where: {
          projectId,
          sourceType: "WEBSITE",
          summary: "已记录官网 evidence 基线",
        },
        data: { title: "website_evidence_baseline" },
      });
    } else if (!isFreshProject) {
      if (prevTitle && currentTitle && prevTitle !== currentTitle) {
        signals.push({
          type: "website_title_change",
          summary: `官网标题由「${prevTitle}」变为「${currentTitle}」`,
          detectedAt,
        });
      }
      if (prevDescription && currentDescription && prevDescription !== currentDescription) {
        signals.push({
          type: "website_description_change",
          summary: "官网 meta description 发生变化",
          detectedAt,
        });
      }
    }
  }

  if (!isFreshProject) {
    const recentSources = await prisma.projectSource.findMany({
      where: {
        projectId,
        createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
      },
      select: { kind: true, url: true, label: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    for (const source of recentSources) {
      const label = source.label ?? source.kind;
      signals.push({
        type: "new_project_source",
        summary: `新增来源 ${label}: ${source.url}`,
        detectedAt: source.createdAt.toISOString(),
      });
    }
  }

  for (const signal of signals) {
    const sourceType: ProjectUpdateSourceType =
      signal.type.startsWith("github")
        ? "GITHUB"
        : signal.type.startsWith("website")
          ? "WEBSITE"
          : "SYSTEM";
    await persistSignal(projectId, signal, sourceType, null, { version: "v2" });
  }

  return signals;
}
