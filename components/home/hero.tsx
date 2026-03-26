import Link from "next/link";
import Image from "next/image";

/** 与 public/brand/muhub_logo_mark.png 一致；与 Header 同一品牌图形 */
const MARK_WIDTH = 365;
const MARK_HEIGHT = 405;

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-zinc-50 via-zinc-50/95 to-zinc-100/80 px-4 pb-24 pt-12 text-center dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-900">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-teal-500/[0.07] to-transparent dark:from-teal-400/[0.08]"
        aria-hidden
      />

      <div className="relative mx-auto flex max-w-2xl flex-col items-center">
        <div className="mb-5 bg-transparent md:mb-6">
          <Image
            src="/brand/muhub_logo_mark.png"
            alt="木哈布"
            width={MARK_WIDTH}
            height={MARK_HEIGHT}
            className="h-auto w-auto max-w-[min(100%,280px)] bg-transparent object-contain object-center sm:max-w-[300px] md:max-w-[320px]"
            priority
          />
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-5xl">
          木哈布
        </h1>

        <p className="mt-3 max-w-lg text-sm font-semibold leading-snug text-teal-800 md:text-base dark:text-teal-300/95">
          AI Native 项目展示与动态聚合平台
        </p>

        <p className="mt-7 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          把仓库、官网和动态收进一页，让合作方、投资人与用户快速理解「项目在做什么、最近有什么进展」——既是主页，也是拿得出手的分享名片。
        </p>

        <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-500">
          可从 GitHub / Gitee 导入起步，也可完全手工维护；多源信息、AI 摘要与周总结按需启用。
        </p>

        <div className="mt-11 flex w-full max-w-lg flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            href="/projects"
            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            浏览项目
          </Link>
          <Link
            href="/dashboard/projects/new"
            className="inline-flex items-center justify-center rounded-xl border border-zinc-300/90 bg-white px-8 py-3.5 text-sm font-semibold text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            创建项目
          </Link>
          <Link
            href="/dashboard/projects/import"
            className="inline-flex items-center justify-center rounded-xl border border-dashed border-zinc-400/90 px-8 py-3.5 text-sm font-semibold text-zinc-700 transition hover:border-teal-600/50 hover:bg-teal-50/50 dark:border-zinc-500 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
          >
            导入项目
          </Link>
        </div>
      </div>
    </section>
  );
}
