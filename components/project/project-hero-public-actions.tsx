"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProjectEngagementPublic } from "@/lib/project-engagement";
import { ProjectEngagementBar } from "@/components/project/project-engagement-bar";
import { ProjectShareDialog } from "@/components/project/project-share-dialog";
import { ProjectSharePoster } from "@/components/project/project-share-poster";
import type { ProjectActivity } from "@/agents/activity/project-activity-store";
import ProjectCopyPromo from "@/components/project/project-copy-promo";

export type ProjectHeroPublicActionsProps = {
  slug: string;
  name: string;
  tagline: string | undefined;
  shareSnippet: string;
  canonicalUrl: string;
  description?: string;
  /** 当前用户可管理该项目时显示「进入管理」 */
  showManageLink: boolean;
  /** 对外认领入口（例如非管理者可见） */
  claimHref?: string;
  /** 分享海报用短文案（tagline / 简介截断） */
  posterIntro: string;
  posterSummary?: string;
  posterHighlights?: string[];
  posterLatestActivity?: ProjectActivity | null;
  promoText: string;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  /** 点赞/关注（仅正式库项目可交互） */
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
  websiteUrl,
  engagement,
}: ProjectHeroPublicActionsProps) {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <div
        className="flex flex-wrap items-start gap-4"
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
        <div className="min-w-[220px]">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Project Links
          </p>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            {websiteUrl?.trim() ? (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={inlineActionClass}
              >
                Visit Website
              </a>
            ) : null}
            {githubUrl?.trim() ? (
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={inlineActionClass}
              >
                View GitHub
              </a>
            ) : null}
          </div>
        </div>
        <div className="min-w-[220px]">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Promote
          </p>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <button type="button" className={inlineActionClass} onClick={() => setShareOpen(true)}>
              <span aria-hidden>📤</span>
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
                      summary: posterLatestActivity.summary,
                    }
                  : null
              }
              projectPageUrl={canonicalUrl}
              githubUrl={githubUrl}
              websiteUrl={websiteUrl}
            />
            <ProjectCopyPromo text={promoText} />
          </div>
        </div>
        {(showManageLink || claimHref) && (
          <div className="min-w-[160px]">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Manage
            </p>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        {showManageLink ? (
          <Link
            href={`/dashboard/projects/${encodeURIComponent(slug)}`}
            className={inlineActionClass}
            data-testid="project-hero-enter-manage"
          >
            <span aria-hidden>⚙️</span>
            管理
          </Link>
        ) : null}
        {claimHref ? (
          <Link href={claimHref} className={inlineActionClass} data-testid="project-hero-claim">
            <span aria-hidden>📋</span>
            认领
          </Link>
        ) : null}
            </div>
          </div>
        )}
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
