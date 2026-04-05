import Link from "next/link";
import type { RecommendedProject } from "@/lib/recommended-projects";

export function RecommendedProjectCard({ project }: { project: RecommendedProject }) {
  const githubHref = `https://github.com/${project.github}`;

  return (
    <article
      data-testid="recommended-project-card"
      className="flex flex-col p-5 muhub-card muhub-card--interactive transition-colors"
    >
      <Link
        href={`/projects/${project.slug}`}
        className="flex flex-1 flex-col rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40"
      >
        <h3 className="text-lg font-bold leading-snug tracking-tight text-zinc-950 sm:text-xl dark:text-zinc-50">
          {project.name}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{project.tagline}</p>
        <span className="mt-4 inline-flex text-sm font-semibold text-teal-800 underline-offset-4 dark:text-teal-300">
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
