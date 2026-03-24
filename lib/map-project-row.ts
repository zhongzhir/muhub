import type { GithubRepoSnapshot, Project, ProjectSocialAccount, ProjectUpdate } from "@prisma/client";
import type { ProjectPageView } from "@/lib/demo-project";

export type ProjectWithRelations = Project & {
  socialAccounts: ProjectSocialAccount[];
  updates: ProjectUpdate[];
  githubSnapshots: GithubRepoSnapshot[];
};

export function mapProjectRowToView(row: ProjectWithRelations): ProjectPageView {
  const snap = row.githubSnapshots[0];
  const githubSnapshot = snap
    ? {
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
      }
    : {
        repoFullName: row.githubUrl?.replace(/^https?:\/\/github\.com\//i, "").replace(/\/$/, "") || "—",
        defaultBranch: "main",
        stars: 0,
        forks: 0,
        openIssues: 0,
        watchers: 0,
        commitCount7d: 0,
        commitCount30d: 0,
        contributorsCount: 0,
      };

  return {
    slug: row.slug,
    name: row.name,
    tagline: row.tagline ?? undefined,
    description: row.description ?? "",
    websiteUrl: row.websiteUrl ?? undefined,
    githubUrl: row.githubUrl ?? undefined,
    githubSnapshot,
    socials: row.socialAccounts.map((s) => ({
      platform: s.platform,
      accountName: s.accountName,
      accountUrl: s.accountUrl ?? undefined,
    })),
    updates: row.updates.map((u) => ({
      sourceType: u.sourceType,
      title: u.title,
      summary: u.summary ?? undefined,
      sourceUrl: u.sourceUrl ?? undefined,
      occurredAt: u.occurredAt ?? u.createdAt,
    })),
    status: row.status,
    createdAt: row.createdAt,
  };
}
