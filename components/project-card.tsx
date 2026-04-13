import Link from "next/link";
import type { ProjectVisibilityStatus } from "@prisma/client";
import type { ProjectListItem } from "@/lib/project-list";
import { formatListDate } from "@/lib/format-date";
import { getProjectCategoryLabel } from "@/lib/projects/project-categories";
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

function visibilityPill(v: ProjectVisibilityStatus): { text: string; className: string } {
  switch (v) {
    case "PUBLISHED":
      return {
        text: "已公开",
        className: "muhub-badge muhub-badge--success",
      };
    case "HIDDEN":
      return {
        text: "已隐藏",
        className: "muhub-badge muhub-badge--warning",
      };
    default:
      return {
        text: "草稿",
        className: "muhub-badge muhub-badge--muted",
      };
  }
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
            <span key={t} className="muhub-badge muhub-badge--neutral">
              {t}
            </span>
          ))}
        </div>
      ) : (
        <p className="muhub-meta-label text-zinc-400 dark:text-zinc-500">外链</p>
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

  const shellClass = `relative flex h-full flex-col muhub-card ${
    isPlaza ? "muhub-card--interactive" : ""
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
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold leading-snug tracking-tight text-zinc-950 line-clamp-2 sm:text-xl dark:text-zinc-50">
            {project.name}
          </h3>
          {!isPlaza && project.visibilityStatus ? (
            <span className={`shrink-0 ${visibilityPill(project.visibilityStatus).className}`}>
              {visibilityPill(project.visibilityStatus).text}
            </span>
          ) : null}
        </div>

        {isPlaza &&
        (project.primaryCategory ||
          project.plazaTags.length > 0 ||
          project.isAiRelated ||
          project.isChineseTool) ? (
          <div className="mb-2 flex flex-wrap items-center gap-1.5" data-testid="project-plaza-discovery-meta">
            {project.primaryCategory?.trim() ? (
              <span className="muhub-badge muhub-badge--category">
                {getProjectCategoryLabel(project.primaryCategory.trim(), project.primaryCategory.trim())}
              </span>
            ) : null}
            {project.plazaTags.map((t) => (
              <span key={t} className="muhub-badge muhub-badge--neutral">
                #{t}
              </span>
            ))}
            {project.isAiRelated ? <span className="muhub-badge muhub-badge--sky">AI</span> : null}
            {project.isChineseTool ? <span className="muhub-badge muhub-badge--amber">中文</span> : null}
          </div>
        ) : null}

        <p className="mb-4 text-sm leading-relaxed text-zinc-600 line-clamp-3 dark:text-zinc-400">{desc}</p>

        <div className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="muhub-meta-label shrink-0">页面路径</span>
            <span className="break-all font-mono text-sm text-zinc-800 dark:text-zinc-200">{project.slug}</span>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <span className="muhub-meta-label">创建时间</span>
            <span className="tabular-nums">{formatListDate(project.createdAt)}</span>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <span className="muhub-meta-label">最近更新</span>
            <span className="tabular-nums">{formatListDate(project.updatedAt)}</span>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <span className="muhub-meta-label">社媒</span>
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
            className="muhub-btn-primary min-h-[2.5rem] w-full text-center"
            data-testid="project-card-manage"
          >
            管理项目
          </Link>
          <Link
            href={publicHref}
            className="muhub-btn-secondary min-h-[2.5rem] w-full text-center font-medium"
            data-testid="project-card-public"
          >
            查看项目
          </Link>
        </div>
      )}
    </article>
  );
}
