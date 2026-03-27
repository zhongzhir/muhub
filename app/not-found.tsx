import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          页面不存在
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          你访问的页面可能已被移动、删除，或链接有误。
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
