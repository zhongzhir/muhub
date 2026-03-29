"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProjectEngagementPublic } from "@/lib/project-engagement";
import { ProjectEngagementBar } from "@/components/project/project-engagement-bar";
import { ProjectShareDialog } from "@/components/project/project-share-dialog";

export type ProjectHeroPublicActionsProps = {
  slug: string;
  name: string;
  tagline: string | undefined;
  shareSnippet: string;
  canonicalUrl: string;
  description?: string;
  /** 当前用户可管理该项目时显示「进入管理」 */
  showManageLink: boolean;
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
  engagement,
}: ProjectHeroPublicActionsProps) {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <div
        className="flex flex-wrap items-baseline gap-x-4 gap-y-2"
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
        <button type="button" className={inlineActionClass} onClick={() => setShareOpen(true)}>
          <span aria-hidden>📤</span>
          分享
        </button>
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
