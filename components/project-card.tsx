import Link from "next/link";
import type { ProjectListItem } from "@/lib/project-list";
import { formatListDate } from "@/lib/format-date";
import { codeHostLinkLabel, parseRepoUrl } from "@/lib/repo-platform";
import { mapSourceLabel } from "@/lib/project-sources";

export type ProjectCardVariant = "default" | "plaza";

function buildPlazaSourceTags(project: ProjectListItem): string[] {
  const seen = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t) {
      seen.add(t);
    }
  };

  for (const k of project.sourceKinds) {
    add(mapSourceLabel(k));
  }

  if (project.githubUrl?.trim()) {
    const p = parseRepoUrl(project.githubUrl);
    const lab = p?.platform === "gitee" ? "Gitee" : "GitHub";
    if (![...project.sourceKinds].some((k) => k === "GITEE" || k === "GITHUB")) {
      add(lab);
    }
  }
  if (
    project.websiteUrl?.trim() &&
    !project.sourceKinds.includes("WEBSITE")
  ) {
    add("官网");
  }

  return [...seen].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function ProjectLinks({
  project,
  isPlaza,
}: {
  project: ProjectListItem;
  isPlaza: boolean;
}) {
  const tags = buildPlazaSourceTags(project);
  const linkPointer = isPlaza ? "pointer-events-auto" : "";

  return (
    <div className={`space-y-2 ${linkPointer}`}>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            >
              {t}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          外链
        </p>
      )}
      <div className="flex flex-col gap-1.5 text-xs text-zinc-500 dark:text-zinc-500">
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
  );
}

export function ProjectCard({
  project,
  variant = "default",
}: {
  project: ProjectListItem;
  variant?: ProjectCardVariant;
}) {
  const desc =
    project.tagline?.trim() ||
    "暂无简介";
  const dashHref = `/dashboard/projects/${encodeURIComponent(project.slug)}`;
  const publicHref = `/projects/${encodeURIComponent(project.slug)}`;
  const isPlaza = variant === "plaza";

  const shellClass = `relative flex h-full flex-col rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${
    isPlaza ? "transition hover:border-zinc-300/90 hover:shadow dark:hover:border-zinc-600" : ""
  }`;

  return (
    <article
      data-testid="project-card"
      data-variant={variant}
      className={shellClass}
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
        className={`flex h-full flex-1 flex-col p-5 ${
          isPlaza ? "relative z-10 pointer-events-none" : ""
        }`}
      >
        <div className="mb-2">
          <h3 className="text-lg font-semibold tracking-tight text-zinc-900 line-clamp-2 dark:text-zinc-50">
            {project.name}
          </h3>
        </div>

        <p className="mb-3 text-sm text-zinc-600 line-clamp-3 dark:text-zinc-400">{desc}</p>

        <div className="text-xs text-zinc-500 space-y-1 dark:text-zinc-400">
          <div className="flex flex-wrap gap-x-2">
            <span className="shrink-0 text-zinc-500 dark:text-zinc-500">页面路径</span>
            <span className="break-all font-mono text-sm text-zinc-800 dark:text-zinc-200">
              {project.slug}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <span className="text-zinc-500 dark:text-zinc-500">创建时间</span>
            <span>{formatListDate(project.createdAt)}</span>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <span className="text-zinc-500 dark:text-zinc-500">社媒</span>
            <span>{project.socialCount > 0 ? `${project.socialCount} 个账号` : "无"}</span>
          </div>
        </div>

        <div className={`mt-auto pt-3 ${isPlaza ? "border-t border-zinc-100 dark:border-zinc-800/80" : ""}`}>
          <ProjectLinks project={project} isPlaza={isPlaza} />
        </div>
      </div>

      {isPlaza ? null : (
        <div className="relative z-10 mt-auto grid gap-2 border-t border-zinc-100 px-5 pb-5 pt-4 sm:grid-cols-2 dark:border-zinc-800">
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
