"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProjectEngagementPublic } from "@/lib/project-engagement";
import { ProjectEngagementBar } from "@/components/project/project-engagement-bar";
import { ProjectShareDialog } from "@/components/project/project-share-dialog";
import { ProjectSharePoster } from "@/components/project/project-share-poster";
import type { ProjectActivity } from "@/lib/activity/project-activity-service";

export type ProjectHeroPublicActionsProps = {
  slug: string;
  name: string;
  tagline: string | undefined;
  shareSnippet: string;
  canonicalUrl: string;
  description?: string;
  tags?: string[];
  category?: string | null;
  claimStatus?: 'CLAIMED' | 'UNCLAIMED';
  showManageLink: boolean;
  claimHref?: string;
  posterIntro: string;
  posterSummary?: string;
  posterHighlights?: string[];
  posterLatestActivity?: ProjectActivity | null;
  githubUrl?: string | null;
  gitccUrl?: string | null;
  websiteUrl?: string | null;
  engagement?: {
    projectId: string | null;
    interactive: boolean;
    viewerLoggedIn: boolean;
    initial: ProjectEngagementPublic;
    signInCallbackPath: string;
  };
};

const primaryBtnClass =
  "inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-750";

const ghostBtnClass =
  "inline-flex items-center gap-1 rounded-full border border-zinc-200/70 px-3.5 py-1.5 text-sm text-zinc-600 transition hover:border-zinc-300 hover:bg-white hover:text-zinc-800 dark:border-zinc-700/50 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200";

const claimBtnClass =
  "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-700/70 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50";

export function ProjectHeroPublicActions({
  slug,
  name,
  tagline,
  shareSnippet,
  canonicalUrl,
  description,
  tags,
  category,
  claimStatus,
  showManageLink,
  claimHref,
  posterIntro,
  posterSummary,
  posterHighlights,
  posterLatestActivity,
  githubUrl,
  gitccUrl,
  websiteUrl,
  engagement,
}: ProjectHeroPublicActionsProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const repoLabel = githubUrl?.includes("gitee.com") ? "View Gitee" : "View GitHub";

  return (
    <>
      <div
        className="flex flex-wrap items-center gap-2"
        data-testid="project-hero-public-actions"
      >
        {engagement ? (
          <ProjectEngagementBar
            slug={slug}
            projectId={engagement.projectId}
            interactive={engagement.interactive}
            viewerLoggedIn={engagement.viewerLoggedIn}
            initial={engagement.initial}
            signInCallbackPath={engagement.signInCallbackPath}
          />
        ) : null}

        {websiteUrl?.trim() ? (
          <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className={primaryBtnClass}>
            Website
          </a>
        ) : null}

        {githubUrl?.trim() ? (
          <a href={githubUrl} target="_blank" rel="noopener noreferrer" className={primaryBtnClass}>
            {repoLabel}
          </a>
        ) : null}

        {gitccUrl?.trim() ? (
          <a href={gitccUrl} target="_blank" rel="noopener noreferrer" className={primaryBtnClass}>
            View GitCC
          </a>
        ) : null}

        <button type="button" className={ghostBtnClass} onClick={() => setShareOpen(true)}>
          Share
        </button>

        <ProjectSharePoster
          slug={slug}
          name={name}
          intro={posterIntro}
          summary={posterSummary}
          highlights={posterHighlights}
          latestActivity={
            posterLatestActivity
              ? {
                  type: posterLatestActivity.type,
                  title: posterLatestActivity.title,
                  occurredAt: posterLatestActivity.occurredAt,
                  summary: posterLatestActivity.summary ?? undefined,
                }
              : null
          }
          projectPageUrl={canonicalUrl}
          githubUrl={githubUrl}
          gitccUrl={gitccUrl}
          websiteUrl={websiteUrl}
          tags={tags}
          category={category}
        />

        {showManageLink ? (
          <Link
            href={`/dashboard/projects/${encodeURIComponent(slug)}`}
            className={ghostBtnClass}
            data-testid="project-hero-enter-manage"
          >
            Manage
          </Link>
        ) : null}

        {claimHref ? (
          <Link href={claimHref} className={claimBtnClass} data-testid="project-hero-claim">
            Claim Project
          </Link>
        ) : null}
      </div>

      <ProjectShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        slug={slug}
        name={name}
        tagline={tagline}
        shareSnippet={shareSnippet}
        canonicalUrl={canonicalUrl}
        description={description}
        tags={tags}
        category={category}
        claimStatus={claimStatus}
      />
    </>
  );
}
