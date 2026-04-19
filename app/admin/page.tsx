import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminHomePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">后台总览</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          按职责进入三个子系统；日常项目维护请优先使用「项目管理」。
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/admin/discovery"
          className="muhub-card block space-y-2 p-5 transition hover:border-zinc-400 dark:hover:border-zinc-600"
        >
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">项目筛选</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Discovery 候选、来源、抓取与补全任务。</p>
        </Link>
        <Link
          href="/admin/projects"
          className="muhub-card block space-y-2 p-5 transition hover:border-zinc-400 dark:hover:border-zinc-600"
        >
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">项目管理</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">正式项目编辑、发布与动态（骨架）。</p>
        </Link>
        <Link
          href="/admin/marketing"
          className="muhub-card block space-y-2 p-5 transition hover:border-zinc-400 dark:hover:border-zinc-600"
        >
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">项目营销</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">海报、文案与活动占位入口。</p>
        </Link>
      </div>
    </div>
  );
}
