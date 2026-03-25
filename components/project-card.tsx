import Link from "next/link";
import type { ProjectListItem } from "@/lib/project-list";
import { formatListDate } from "@/lib/format-date";
import { projectStatusLabel } from "@/lib/project-status";

export function ProjectCard({ project }: { project: ProjectListItem }) {
  const taglineDisplay = project.tagline?.trim() ? project.tagline : "暂无简介";

  return (
    <article
      data-testid="project-card"
      className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-1 flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {project.name}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{taglineDisplay}</p>
        </div>

        <dl className="grid gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-zinc-500">slug</dt>
            <dd className="font-mono text-zinc-800 dark:text-zinc-200">{project.slug}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-zinc-500">创建时间</dt>
            <dd>{formatListDate(project.createdAt)}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-zinc-500">状态</dt>
            <dd>{projectStatusLabel(project.status)}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-zinc-500">社媒</dt>
            <dd>{project.socialCount > 0 ? `${project.socialCount} 个账号` : "无"}</dd>
          </div>
        </dl>

        {project.githubUrl ? (
          <a
            href={project.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            GitHub
          </a>
        ) : (
          <span className="text-sm text-zinc-400">未填写 GitHub</span>
        )}
      </div>

      <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <Link
          href={`/projects/${project.slug}`}
          className="inline-flex text-sm font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
        >
          查看项目
        </Link>
      </div>
    </article>
  );
}
