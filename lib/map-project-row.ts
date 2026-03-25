import type { GithubRepoSnapshot, Project, ProjectSocialAccount, ProjectUpdate } from "@prisma/client";
import type { ProjectPageView } from "@/lib/demo-project";
import { parseRepoUrl } from "@/lib/repo-platform";

export type ProjectWithRelations = Project & {
  socialAccounts: ProjectSocialAccount[];
  updates: ProjectUpdate[];
  githubSnapshots: GithubRepoSnapshot[];
};

export function mapProjectRowToView(row: ProjectWithRelations): ProjectPageView {
  const snap = row.githubSnapshots[0];
  const inferredPlatform =
    snap?.repoPlatform === "github" || snap?.repoPlatform === "gitee"
      ? snap.repoPlatform
      : parseRepoUrl(row.githubUrl ?? "")?.platform;

  const githubSnapshot = snap
    ? {
        repoPlatform: inferredPlatform,
        repoOwner: snap.repoOwner ?? undefined,
        repoName: snap.repoName ?? undefined,
        repoFullName: snap.repoFullName,
        defaultBranch: snap.defaultBranch ?? undefined,
        stars: snap.stars,
        forks: snap.forks,
        openIssues: snap.openIssues,
        watchers: snap.watchers,
        commitCount7d: snap.commitCount7d,
        commitCount30d: snap.commitCount30d,
        contributorsCount: snap.contributorsCount,
        lastCommitAt: snap.lastCommitAt ?? undefined,
        fetchedAt: snap.fetchedAt,
        latestReleaseTag: snap.latestReleaseTag ?? undefined,
        latestReleaseAt: snap.latestReleaseAt ?? undefined,
      }
    : null;

  return {
    slug: row.slug,
    name: row.name,
    logoUrl: row.logoUrl ?? undefined,
    tagline: row.tagline ?? undefined,
    description: row.description ?? "",
    tags: row.tags?.length ? [...row.tags] : [],
    websiteUrl: row.websiteUrl ?? undefined,
    githubUrl: row.githubUrl ?? undefined,
    githubSnapshot,
    socials: row.socialAccounts.map((s) => ({
      platform: s.platform,
      accountName: s.accountName,
      accountUrl: s.accountUrl ?? undefined,
    })),
    updates: row.updates.map((u) => ({
      id: u.id,
      sourceType: u.sourceType,
      sourceLabel: u.sourceLabel ?? undefined,
      title: u.title,
      summary: u.summary ?? undefined,
      content: u.content ?? undefined,
      sourceUrl: u.sourceUrl ?? undefined,
      metaJson: u.metaJson ?? undefined,
      isAiGenerated: u.isAiGenerated,
      occurredAt: u.occurredAt ?? u.createdAt,
      createdAt: u.createdAt,
    })),
    status: row.status,
    createdAt: row.createdAt,
    claimStatus: row.claimStatus,
    claimedAt: row.claimedAt ?? null,
    claimedBy: row.claimedBy ?? null,
    sourceType: row.sourceType ?? undefined,
    isFeatured: row.isFeatured,
  };
}
