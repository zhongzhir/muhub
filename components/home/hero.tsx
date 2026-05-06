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
        {/* AI badge */}
        <div className="mb-5 sm:mb-6">
          <span className="inline-flex items-center rounded-full border border-teal-400/60 bg-teal-50/80 px-3.5 py-1 text-xs font-medium tracking-wide text-teal-700 dark:border-teal-500/40 dark:bg-teal-950/60 dark:text-teal-300">
            AI 时代的项目公众主页
          </span>
        </div>

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

        <p className="mt-4 max-w-xl text-base font-medium leading-[1.7] text-zinc-600 dark:text-zinc-400 sm:text-lg">
          帮助 AI 时代的项目{" "}
          <span className="text-teal-600 dark:text-teal-400">被看见</span>、
          <span className="text-teal-600 dark:text-teal-400">被理解</span>、
          <span className="text-teal-600 dark:text-teal-400">被联系</span>。
          <br className="hidden sm:block" />
          <span className="text-zinc-500 dark:text-zinc-500">
            从项目主页到传播资产，让好项目不再埋没。
          </span>
        </p>

        {/* 三列价值说明 */}
        <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200/60 bg-white/60 px-4 py-3 text-left backdrop-blur-sm dark:border-zinc-700/50 dark:bg-zinc-900/50">
            <div className="mb-1.5 text-lg">{"🔍"}</div>
            <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{"被看见"}</div>
            <div className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {"项目主页 · 广场展示 · 分享卡片"}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200/60 bg-white/60 px-4 py-3 text-left backdrop-blur-sm dark:border-zinc-700/50 dark:bg-zinc-900/50">
            <div className="mb-1.5 text-lg">{"💡"}</div>
            <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{"被理解"}</div>
            <div className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {"AI 结构化表达 · 传播内容生成"}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200/60 bg-white/60 px-4 py-3 text-left backdrop-blur-sm dark:border-zinc-700/50 dark:bg-zinc-900/50">
            <div className="mb-1.5 text-lg">{"🔗"}</div>
            <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{"被联系"}</div>
            <div className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {"标准化联系入口 · 合作/招聘/试用"}
            </div>
          </div>
        </div>

        <div className="mt-10 flex w-full max-w-lg flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
          <Link
            href="/projects"
            className="muhub-btn-primary w-full px-8 py-3.5 shadow-md ring-1 ring-black/[0.06] sm:w-auto dark:ring-white/10"
          >
            浏览项目广场
          </Link>
          <Link href="/projects?claim=1" className="muhub-btn-secondary w-full px-8 py-3.5 sm:w-auto">
            认领你的项目
          </Link>
        </div>
      </div>
    </section>
  );
}
