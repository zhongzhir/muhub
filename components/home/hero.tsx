import Link from "next/link";
import Image from "next/image";
import { SiteShareActions } from "@/components/home/site-share-actions";

/** 与 public/brand/muhub_logo_mark.png 源比例一致；展示尺寸由 Tailwind 控制（移动端优先） */
const MARK_WIDTH = 365;
const MARK_HEIGHT = 405;

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-zinc-200/60 bg-gradient-to-b from-zinc-50 via-zinc-50 to-zinc-100/85 px-4 pb-20 pt-11 text-center sm:pb-24 sm:pt-14 dark:border-zinc-800/70 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
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

      <div className="relative mx-auto flex max-w-2xl flex-col items-center">
        <div className="mb-7 flex w-full justify-center bg-transparent sm:mb-9">
          <Image
            src="/brand/muhub_logo_mark.png"
            alt="木哈布"
            width={MARK_WIDTH}
            height={MARK_HEIGHT}
            className="h-auto w-24 bg-transparent object-contain object-center md:w-32 lg:w-36"
            priority
          />
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl md:text-5xl md:tracking-tight">
          木哈布 MUHUB
        </h1>

        <h2 className="mt-4 max-w-lg px-1 text-sm font-medium leading-snug text-teal-800 sm:text-base dark:text-teal-300/90">
          AI Native 项目展示平台
        </h2>

        <p className="mt-5 max-w-xl text-base font-medium leading-[1.65] text-zinc-700 dark:text-zinc-300">
          把代码仓库、官网和进展整合成一张活的名片。
        </p>

        <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          可从 GitHub / Gitee 导入，也可手工创建。
        </p>

        <div className="mt-12 flex w-full max-w-lg flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
          <Link
            href="/projects"
            className="muhub-btn-primary w-full px-8 py-3.5 shadow-md ring-1 ring-black/[0.06] sm:w-auto dark:ring-white/10"
          >
            项目广场
          </Link>
          <Link href="/dashboard/projects/new" className="muhub-btn-secondary w-full px-8 py-3.5 sm:w-auto">
            创建项目
          </Link>
        </div>

        <SiteShareActions />
      </div>
    </section>
  );
}
