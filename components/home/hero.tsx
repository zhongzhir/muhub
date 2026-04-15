import Link from "next/link";
import Image from "next/image";

/** 与 public/brand/muhub_logo_mark.png 源比例一致；展示尺寸由 Tailwind 控制（移动端优先） */
const MARK_WIDTH = 365;
const MARK_HEIGHT = 405;

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-zinc-200/60 bg-gradient-to-b from-zinc-50 via-zinc-50 to-zinc-100/85 px-4 pb-16 pt-10 text-center sm:pb-20 sm:pt-12 dark:border-zinc-800/70 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div
        className="pointer-events-none absolute inset-0 muhub-hero-grid opacity-[0.5] dark:opacity-[0.28]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-white/75 via-transparent to-transparent dark:from-zinc-950/80"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-teal-500/[0.06] to-transparent dark:from-teal-400/[0.07]"
        aria-hidden
      />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center">
        <div className="mb-6 flex w-full justify-center bg-transparent sm:mb-8">
          <Image
            src="/brand/muhub_logo_mark.png"
            alt="木哈布"
            width={MARK_WIDTH}
            height={MARK_HEIGHT}
            className="h-auto w-20 bg-transparent object-contain object-center md:w-24 lg:w-28"
            priority
          />
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl md:text-5xl">
          木哈布 MUHUB
        </h1>

        <p className="mt-4 max-w-2xl text-base font-medium leading-[1.65] text-zinc-700 dark:text-zinc-300 sm:text-lg">
          真实项目入口与动态信息流，持续聚合公开项目与最新进展。
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <span className="rounded-full border border-zinc-300 bg-white/80 px-2.5 py-1 dark:border-zinc-700 dark:bg-zinc-900/70">
            真实项目
          </span>
          <span className="rounded-full border border-zinc-300 bg-white/80 px-2.5 py-1 dark:border-zinc-700 dark:bg-zinc-900/70">
            持续更新
          </span>
          <span className="rounded-full border border-zinc-300 bg-white/80 px-2.5 py-1 dark:border-zinc-700 dark:bg-zinc-900/70">
            公开信息聚合
          </span>
        </div>

        <div className="mt-10 flex w-full max-w-lg flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
          <Link
            href="/projects"
            className="muhub-btn-primary w-full px-8 py-3.5 shadow-md ring-1 ring-black/[0.06] sm:w-auto dark:ring-white/10"
          >
            浏览项目
          </Link>
          <Link href="/projects?sort=updated" className="muhub-btn-secondary w-full px-8 py-3.5 sm:w-auto">
            查看最新动态
          </Link>
        </div>
      </div>
    </section>
  );
}
