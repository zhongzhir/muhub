import Link from "next/link";
import Image from "next/image";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-3 text-zinc-900 transition hover:opacity-90 dark:text-zinc-50"
          aria-label="木哈布 首页"
        >
          <Image
            src="/brand/icon.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-lg object-cover"
            priority
          />
          <span className="text-lg font-bold tracking-tight">木哈布</span>
        </Link>
        <nav className="ml-auto flex flex-wrap items-center gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          <Link href="/projects" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            浏览项目
          </Link>
          <Link href="/dashboard/projects/new" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            创建项目
          </Link>
          <Link href="/dashboard/projects/import" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            导入项目
          </Link>
        </nav>
      </div>
    </header>
  );
}
