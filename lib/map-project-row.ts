import type {
  GithubRepoSnapshot,
  Project,
  ProjectExternalLink,
  ProjectSocialAccount,
  ProjectSource,
  ProjectUpdate,
  ProjectWeeklySummary,
} from "@prisma/client";
import { stringArrayFromJson } from "@/lib/discovery/sync-discovery-to-project";
import { normalizeReferenceSources } from "@/lib/discovery/reference-sources";
import type { ProjectPageView } from "@/lib/demo-project";
import { parseRepoUrl } from "@/lib/repo-platform";

export type ProjectWithRelations = Project & {
  socialAccounts: ProjectSocialAccount[];
  sources: ProjectSource[];
  updates: ProjectUpdate[];
  githubSnapshots: GithubRepoSnapshot[];
  weeklySummaries: ProjectWeeklySummary[];
  externalLinks: ProjectExternalLink[];
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

  const latestWeekly = row.weeklySummaries[0];

  const extOrder = [
    "website",
    "github",
    "docs",
    "twitter",
    "youtube",
    "discord",
    "blog",
    "telegram",
  ];
  const externalLinks = [...row.externalLinks]
    .filter((e) => Boolean(e.url?.trim()))
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) {
        return a.isPrimary ? -1 : 1;
      }
      const ia = extOrder.indexOf(a.platform.toLowerCase());
      const ib = extOrder.indexOf(b.platform.toLowerCase());
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.url.localeCompare(b.url);
    })
    .map((e) => ({
      platform: e.platform,
      url: e.url,
      label: e.label ?? undefined,
      isPrimary: e.isPrimary,
      source: e.source ?? null,
    }));

  return {
    slug: row.slug,
    name: row.name,
    logoUrl: row.logoUrl ?? undefined,
    tagline: row.tagline ?? undefined,
    simpleSummary: row.simpleSummary ?? undefined,
    description: row.description ?? "",
    tags: row.tags?.length ? [...row.tags] : [],
    categories: stringArrayFromJson(row.categoriesJson),
    primaryCategory: row.primaryCategory ?? undefined,
    isAiRelated: row.isAiRelated ?? undefined,
    isChineseTool: row.isChineseTool ?? undefined,
    externalLinks,
    referenceSources: normalizeReferenceSources(row.referenceSources).map((item) => ({
      title: item.title ?? undefined,
      url: item.url,
      summary: item.note ?? undefined,
      sourceName: item.source ?? undefined,
      type: item.type,
    })),
    aiCardSummary: row.aiCardSummary ?? undefined,
    aiWeeklySummary: latestWeekly
      ? {
          summary: latestWeekly.summary,
          startAt: latestWeekly.startAt,
          endAt: latestWeekly.endAt,
          createdAt: latestWeekly.createdAt,
        }
      : null,
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
    sources: row.sources.map((s) => ({
      id: s.id,
      kind: s.kind,
      url: s.url,
      label: s.label ?? undefined,
      isPrimary: s.isPrimary,
    })),
    fromDiscovery: Boolean(row.importedFromCandidateId),
  };
}
