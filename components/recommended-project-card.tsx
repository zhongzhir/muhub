import Link from "next/link";
import type { RecommendedProject } from "@/lib/recommended-projects";

export function RecommendedProjectCard({ project }: { project: RecommendedProject }) {
  const githubHref = `https://github.com/${project.github}`;

  return (
    <article
      data-testid="recommended-project-card"
      className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <Link
        href={`/projects/${project.slug}`}
        className="flex flex-1 flex-col rounded-lg outline-none ring-zinc-400 focus-visible:ring-2"
      >
        <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {project.name}
        </h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{project.tagline}</p>
        <span className="mt-3 inline-flex text-sm font-medium text-zinc-900 underline-offset-4 dark:text-zinc-100">
          查看详情 →
        </span>
      </Link>
      <a
        href={githubHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex text-sm text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
      >
        GitHub（{project.github}）
      </a>
    </article>
  );
}
