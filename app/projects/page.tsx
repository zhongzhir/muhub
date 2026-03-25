import Link from "next/link";
import { ProjectCard } from "@/components/project-card";
import { fetchPublicProjects } from "@/lib/project-list";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function ProjectsListPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const searchTerm = typeof q === "string" ? q.trim() : "";
  const { items, error } = await fetchPublicProjects(q);

  const showEmptyAll = !error && items.length === 0 && !searchTerm;
  const showEmptySearch = !error && items.length === 0 && Boolean(searchTerm);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="mb-6 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
        </p>

        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">项目广场</h1>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
            浏览 MUHUB 上公开展示的创业项目（仅展示标记为公开的项目）。
          </p>
        </header>

        <section className="mb-10">
          <form action="/projects" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="projects-search" className="sr-only">
                搜索项目
              </label>
              <input
                id="projects-search"
                name="q"
                type="search"
                defaultValue={searchTerm}
                placeholder="按名称、slug 或一句话介绍搜索"
                aria-label="搜索项目"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:focus:border-zinc-400"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              搜索
            </button>
          </form>
          {searchTerm ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              当前搜索：<span className="font-medium text-zinc-900 dark:text-zinc-100">{searchTerm}</span>
            </p>
          ) : null}
        </section>

        {error ? (
          <div
            role="alert"
            className="mb-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
          >
            {error}
          </div>
        ) : null}

        <section aria-label="项目列表">
          {showEmptyAll ? (
            <p
              data-testid="projects-empty-all"
              className="rounded-lg border border-dashed border-zinc-300 bg-zinc-100/50 px-6 py-12 text-center text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400"
            >
              暂无公开项目
            </p>
          ) : null}

          {showEmptySearch ? (
            <p
              data-testid="projects-empty-search"
              className="rounded-lg border border-dashed border-zinc-300 bg-zinc-100/50 px-6 py-12 text-center text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400"
            >
              没有找到匹配的项目
            </p>
          ) : null}

          {items.length > 0 ? (
            <ul className="grid gap-6 sm:grid-cols-2">
              {items.map((p) => (
                <li key={p.slug}>
                  <ProjectCard project={p} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
