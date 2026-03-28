"use client";

import Link from "next/link";
import { useState } from "react";
import { ProjectShareDialog } from "@/components/project/project-share-dialog";

export type ProjectHeroPublicActionsProps = {
  slug: string;
  name: string;
  tagline: string | undefined;
  shareSnippet: string;
  canonicalUrl: string;
  shareClipboardText: string;
  /** 当前用户可管理该项目时显示「进入管理」 */
  showManageLink: boolean;
};

const shareBtnClass =
  "inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 sm:w-auto dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-800";

const manageLinkClass =
  "inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-center text-sm font-medium text-zinc-600 underline-offset-4 transition hover:bg-zinc-100/80 hover:text-zinc-900 hover:underline sm:w-auto dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200";

export function ProjectHeroPublicActions({
  slug,
  name,
  tagline,
  shareSnippet,
  canonicalUrl,
  shareClipboardText,
  showManageLink,
}: ProjectHeroPublicActionsProps) {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div
      className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:flex-col lg:items-end"
      data-testid="project-hero-public-actions"
    >
      <button type="button" className={shareBtnClass} onClick={() => setShareOpen(true)}>
        分享项目
      </button>
      {showManageLink ? (
        <Link
          href={`/dashboard/projects/${encodeURIComponent(slug)}`}
          className={manageLinkClass}
          data-testid="project-hero-enter-manage"
        >
          进入管理
        </Link>
      ) : null}
      <ProjectShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        name={name}
        tagline={tagline}
        shareSnippet={shareSnippet}
        canonicalUrl={canonicalUrl}
        shareClipboardText={shareClipboardText}
      />
    </div>
  );
}
