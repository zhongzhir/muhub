import Link from "next/link";
import type { ProjectListItem } from "@/lib/project-list";
import { formatListDate } from "@/lib/format-date";
import { codeHostLinkLabel } from "@/lib/repo-platform";

export type ProjectCardVariant = "default" | "plaza";

export function ProjectCard({
  project,
  variant = "default",
}: {
  project: ProjectListItem;
  variant?: ProjectCardVariant;
}) {
  const taglineDisplay = project.tagline?.trim() ? project.tagline : "暂无简介";
  const dashHref = `/dashboard/projects/${encodeURIComponent(project.slug)}`;
  const publicHref = `/projects/${encodeURIComponent(project.slug)}`;
  const isPlaza = variant === "plaza";

  return (
    <article
      data-testid="project-card"
      data-variant={variant}
      className={`relative flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${
        isPlaza ? "transition hover:border-zinc-300/90 hover:shadow dark:hover:border-zinc-600" : ""
      }`}
    >
      {isPlaza ? (
        <Link
          href={publicHref}
          className="absolute inset-0 z-0 rounded-xl outline-offset-2 focus-visible:outline focus-visible:ring-2 focus-visible:ring-teal-600/40"
          aria-label={`查看项目：${project.name}`}
        >
          <span className="sr-only">查看项目</span>
        </Link>
      ) : null}
      <div
        className={`flex flex-1 flex-col gap-3 ${isPlaza ? "relative z-10 pointer-events-none" : ""}`}
      >
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {project.name}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{taglineDisplay}</p>
        </div>

        <dl className="grid gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          <div className="flex flex-wrap gap-x-2">
            <dt className="shrink-0 text-zinc-500">页面路径</dt>
            <dd className="break-all font-mono text-sm text-zinc-800 dark:text-zinc-200">{project.slug}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-zinc-500">创建时间</dt>
            <dd>{formatListDate(project.createdAt)}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-zinc-500">社媒</dt>
            <dd>{project.socialCount > 0 ? `${project.socialCount} 个账号` : "无"}</dd>
          </div>
        </dl>

        <div
          className={`border-t border-zinc-100 pt-3 dark:border-zinc-800/80 ${isPlaza ? "pointer-events-auto" : ""}`}
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">外链</p>
          <div className="mt-1.5 flex flex-col gap-1.5 text-xs text-zinc-500 dark:text-zinc-500">
            {project.githubUrl ? (
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
              >
                {codeHostLinkLabel(project.githubUrl)}
              </a>
            ) : (
              <span className="text-zinc-400">未填写代码仓库</span>
            )}
            {project.websiteUrl?.trim() ? (
              <a
                href={project.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
              >
                官网
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {isPlaza ? null : (
        <div className="relative z-10 mt-4 grid gap-2 border-t border-zinc-100 pt-4 sm:grid-cols-2 dark:border-zinc-800">
          <Link
            href={dashHref}
            className="inline-flex min-h-[2.5rem] items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            data-testid="project-card-manage"
          >
            管理项目
          </Link>
          <Link
            href={publicHref}
            className="inline-flex min-h-[2.5rem] items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            data-testid="project-card-public"
          >
            查看项目
          </Link>
        </div>
      )}
    </article>
  );
}
