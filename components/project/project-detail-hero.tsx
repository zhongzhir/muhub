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

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50 px-6 py-8 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950 md:px-10 md:py-10"
      aria-labelledby="project-detail-title"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-x-10">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">项目主页</p>

          <h1
            id="project-detail-title"
            className="mt-2 text-4xl font-bold tracking-tight text-zinc-900 md:text-5xl dark:text-zinc-50"
          >
            {name}
          </h1>

          {tagline?.trim() ? (
            <>
              <h2 id="project-tagline-heading" className="sr-only">
                项目简介
              </h2>
              <p
                className="mt-4 max-w-3xl text-lg leading-snug text-zinc-600 dark:text-zinc-400"
                aria-labelledby="project-tagline-heading"
              >
                {tagline}
              </p>
            </>
          ) : null}

          <dl className="mt-6 grid gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-zinc-500">项目访问地址</dt>
              <dd className="break-all font-mono text-zinc-800 dark:text-zinc-200">{publicPath}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-zinc-500">创建时间</dt>
              <dd>{formatListDate(createdAt)}</dd>
            </div>
          </dl>
        </div>

        {actions ? <div className="min-w-0 lg:max-w-xs lg:justify-self-end">{actions}</div> : null}
      </div>

      <div className="mt-6 border-t border-zinc-200/80 pt-6 dark:border-zinc-800">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline dark:hover:text-zinc-300"
        >
          ← 返回首页
        </Link>
      </div>
    </section>
  );
}
