import type { ReactNode } from "react";
import Link from "next/link";
import { projectPublicPathPrefix } from "@/lib/seo/site";
import { formatListDate } from "@/lib/format-date";

export type ProjectDetailHeroProps = {
  slug: string;
  name: string;
  tagline: string | undefined;
  createdAt: Date;
  /** 公开页：分享、进入管理等（通常为客户端岛） */
  actions?: ReactNode;
};

export function ProjectDetailHero({
  slug,
  name,
  tagline,
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
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-400">
          项目主页
        </p>

        <h1
          id="project-detail-title"
          className="mt-3 text-4xl font-bold tracking-tight text-zinc-950 md:text-5xl dark:text-zinc-50"
        >
          {name}
        </h1>

        {tagline?.trim() ? (
          <>
            <h2 id="project-tagline-heading" className="sr-only">
              项目简介
            </h2>
            <p
              className="mt-5 max-w-3xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400"
              aria-labelledby="project-tagline-heading"
            >
              {tagline}
            </p>
          </>
        ) : null}

        <dl className="mt-7 grid gap-2.5 text-sm text-zinc-600 dark:text-zinc-400">
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
