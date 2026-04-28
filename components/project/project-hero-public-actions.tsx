"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProjectEngagementPublic } from "@/lib/project-engagement";
import { ProjectEngagementBar } from "@/components/project/project-engagement-bar";
import { ProjectShareDialog } from "@/components/project/project-share-dialog";
import { ProjectSharePoster } from "@/components/project/project-share-poster";
import type { ProjectActivity } from "@/lib/activity/project-activity-service";
import ProjectCopyPromo from "@/components/project/project-copy-promo";

export type ProjectHeroPublicActionsProps = {
  slug: string;
  name: string;
  tagline: string | undefined;
  shareSnippet: string;
  canonicalUrl: string;
  description?: string;
  showManageLink: boolean;
  claimHref?: string;
  posterIntro: string;
  posterSummary?: string;
  posterHighlights?: string[];
  posterLatestActivity?: ProjectActivity | null;
  promoText: string;
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

const inlineActionClass =
  "inline-flex max-w-full shrink-0 items-baseline gap-1 rounded-md px-1 py-0.5 text-sm text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200";

export function ProjectHeroPublicActions({
  slug,
  name,
  tagline,
  shareSnippet,
  canonicalUrl,
  description,
  showManageLink,
  claimHref,
  posterIntro,
  posterSummary,
  posterHighlights,
  posterLatestActivity,
  promoText,
  githubUrl,
  gitccUrl,
  websiteUrl,
  engagement,
}: ProjectHeroPublicActionsProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const repoLabel = githubUrl?.includes("gitee.com") ? "查看 Gitee" : "查看 GitHub";

  return (
    <>
      <div
        className="flex flex-wrap items-start gap-x-4 gap-y-2"
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
          <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className={inlineActionClass}>
            访问官网
          </a>
        ) : null}
        {githubUrl?.trim() ? (
          <a href={githubUrl} target="_blank" rel="noopener noreferrer" className={inlineActionClass}>
            {repoLabel}
          </a>
        ) : null}
        {gitccUrl?.trim() ? (
          <a href={gitccUrl} target="_blank" rel="noopener noreferrer" className={inlineActionClass}>
            查看 GitCC
          </a>
        ) : null}

        <button type="button" className={inlineActionClass} onClick={() => setShareOpen(true)}>
          分享
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
        />
        <ProjectCopyPromo text={promoText} />

        {showManageLink ? (
          <Link
            href={`/dashboard/projects/${encodeURIComponent(slug)}`}
            className={inlineActionClass}
            data-testid="project-hero-enter-manage"
          >
            管理
          </Link>
        ) : null}
        {claimHref ? (
          <Link href={claimHref} className={inlineActionClass} data-testid="project-hero-claim">
            认领
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
      />
    </>
  );
}
