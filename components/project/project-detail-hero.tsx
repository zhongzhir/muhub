import type { ReactNode } from "react";
import Link from "next/link";
import { projectPublicPathPrefix } from "@/lib/seo/site";
import { formatListDate } from "@/lib/format-date";
import ProjectHeroMetrics from "@/components/project/project-hero-metrics";
import ProjectHeroLatestActivity from "@/components/project/project-hero-latest-activity";

export type ProjectDetailHeroProps = {
  slug: string;
  name: string;
  tagline: string | undefined;
  summary?: string;
  highlights?: string[];
  stars?: number;
  lastCommitAt?: string | Date | null;
  contributors?: number;
  latestActivity?: {
    title: string;
    type:
      | "project_imported"
      | "project_profile_updated"
      | "github_repo_updated"
      | "github_release_detected"
      | "official_update_detected";
    occurredAt: string;
  } | null;
  createdAt: Date;
  /** 公开页：分享、进入管理等（通常为客户端岛） */
  actions?: ReactNode;
};

export function ProjectDetailHero({
  slug,
  name,
  tagline,
  summary,
  highlights,
  stars,
  lastCommitAt,
  contributors,
  latestActivity,
  createdAt,
  actions,
}: ProjectDetailHeroProps) {
  const pathPrefix = projectPublicPathPrefix();
  const publicPath = `${pathPrefix}${slug}`;

  const actionBarClass =
    "mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-t border-zinc-200/80 pt-6 dark:border-zinc-800";

  const backClass =
    "inline-flex shrink-0 items-baseline gap-1 rounded-md px-0.5 py-0.5 text-sm text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200";

  return (
    <section
      className="muhub-detail-hero relative overflow-hidden px-6 py-8 md:px-10 md:py-10"
      aria-labelledby="project-detail-title"
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-800/90 dark:text-teal-400/90">
          <span>项目主页</span>
          <span className="mx-1 text-zinc-400">·</span>
          <span>MUHUB Project Profile</span>
        </p>

        <h1
          id="project-detail-title"
          className="mt-2 text-4xl font-bold tracking-tight text-zinc-950 md:text-6xl dark:text-zinc-50"
        >
          {name}
        </h1>

        {(summary?.trim() || tagline?.trim()) ? (
          <>
            <h2 id="project-tagline-heading" className="sr-only">
              项目简介
            </h2>
            <p
              className="mt-2 line-clamp-2 max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-zinc-400"
              aria-labelledby="project-tagline-heading"
            >
              {summary?.trim() || tagline}
            </p>
          </>
        ) : null}

        <ProjectHeroMetrics stars={stars} updatedAt={lastCommitAt} contributors={contributors} />

        <ProjectHeroLatestActivity activity={latestActivity} />

        {highlights?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {highlights.slice(0, 4).map((h) => (
              <span key={h} className="rounded-md border px-2 py-1 text-xs">
                {h}
              </span>
            ))}
          </div>
        ) : null}

        <dl className="mt-6 grid gap-2.5 text-sm text-zinc-600 dark:text-zinc-400">
          <div className="flex flex-wrap gap-x-2">
            <dt className="shrink-0 text-xs font-medium text-zinc-500">项目访问地址</dt>
            <dd className="break-all font-mono text-zinc-800 dark:text-zinc-200">{publicPath}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="shrink-0 text-xs font-medium text-zinc-500">创建时间</dt>
            <dd>{formatListDate(createdAt)}</dd>
          </div>
        </dl>
      </div>

      <div className={actionBarClass} role="toolbar" aria-label="项目快捷操作">
        <Link href="/" className={backClass}>
          <span aria-hidden>←</span>
          返回首页
        </Link>
        {actions}
      </div>
    </section>
  );
}
