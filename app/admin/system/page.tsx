import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminSystemHomePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          系统后台
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          平台级运营入口，面向用户与全局数据，不影响项目业务后台主流程。
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/system/users"
          className="muhub-card block space-y-2 p-5 transition hover:border-zinc-400 dark:hover:border-zinc-600"
        >
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">用户管理</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            查看用户列表、管理员标识与会话概况，支持按名称/邮箱搜索。
          </p>
        </Link>
        <Link
          href="/admin/system/analytics"
          className="muhub-card block space-y-2 p-5 transition hover:border-zinc-400 dark:hover:border-zinc-600"
        >
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">数据概览</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            用户、项目、Discovery 与运营日志的最小统计看板。
          </p>
        </Link>
      </div>
    </div>
  );
}
