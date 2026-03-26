import Link from "next/link";

export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-white to-zinc-50 px-4 py-20 text-center dark:from-zinc-950 dark:to-zinc-900">
      <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">木哈布</h1>
      <p className="mx-auto mt-4 max-w-xl text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
        AI Native 项目展示平台
      </p>

      <p className="mx-auto mt-5 max-w-2xl text-lg leading-snug text-zinc-600 dark:text-zinc-300">
        统一展示开源与创业项目，聚合仓库、官网与多源动态；结合 AI 生成摘要与周总结，
        <span className="font-medium text-zinc-800 dark:text-zinc-200">方便介绍、协作与融资准备</span>。
      </p>

      <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
        从 GitHub / Gitee 导入仓库，几分钟内生成可分享的<strong className="font-medium text-zinc-700 dark:text-zinc-300">项目名片</strong>
        与亮点页。
      </p>

      <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Link
          href="/projects"
          className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          浏览项目
        </Link>
        <Link
          href="/dashboard/projects/new"
          className="inline-flex items-center justify-center rounded-xl border-2 border-zinc-300 bg-white px-8 py-3.5 text-sm font-semibold text-zinc-900 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          创建项目
        </Link>
        <Link
          href="/dashboard/projects/import"
          className="inline-flex items-center justify-center rounded-xl border border-dashed border-zinc-400 px-8 py-3.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-500 hover:bg-zinc-100/80 dark:border-zinc-500 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
        >
          导入项目
        </Link>
      </div>
    </section>
  );
}
