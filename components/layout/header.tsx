import Image from "next/image";
import Link from "next/link";

/** 与 public/brand/muhub_logo_mark.png 一致；与 Hero 同一品牌图形 */
const MARK_WIDTH = 365;
const MARK_HEIGHT = 405;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/35 bg-white/70 backdrop-blur-md dark:border-zinc-800/35 dark:bg-zinc-950/75">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
        <Link
          href="/"
          className="-m-1 flex shrink-0 items-center rounded-md p-1 outline-offset-2 transition hover:opacity-[0.92] focus-visible:outline focus-visible:ring-2 focus-visible:ring-teal-600/35 dark:focus-visible:ring-teal-500/40"
          aria-label="木哈布首页"
        >
          <Image
            src="/brand/muhub_logo_mark.png"
            alt="木哈布"
            width={MARK_WIDTH}
            height={MARK_HEIGHT}
            className="h-8 w-auto md:h-9"
            priority
          />
        </Link>
        <nav
          className="ml-auto flex flex-wrap items-center justify-end gap-0.5 sm:gap-1"
          aria-label="主导航"
        >
          <Link
            href="/projects"
            className="rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100/90 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
          >
            浏览项目
          </Link>
          <Link
            href="/dashboard/projects/new"
            className="rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100/90 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
          >
            创建项目
          </Link>
          <Link
            href="/dashboard/projects/import"
            className="rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100/90 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
          >
            导入项目
          </Link>
        </nav>
      </div>
    </header>
  );
}
