import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <main className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-24">
        <header className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">MUHUB</h1>
          <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            MUHUB 用于聚合与展示开源及创意项目：收录项目信息、社媒账号、GitHub
            指标与更新动态，帮助社区发现与跟踪你关心的作品。
          </p>
        </header>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/projects"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium shadow-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            浏览项目
          </Link>
          <Link
            href="/dashboard/projects/new"
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            创建项目
          </Link>
        </div>
      </main>
    </div>
  );
}
