import Link from "next/link";

export function ProjectClaimCta() {
  return (
    <section className="border-t border-zinc-200/80 py-14 dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-7 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">项目认领 / 入驻引导</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            如果这是你的项目，后续可认领项目主页、完善官方信息并持续发布动态。当前认领入口正逐步开放。
          </p>
          <div className="mt-5">
            <Link href="/feedback" className="muhub-btn-secondary inline-flex px-4 py-2.5 text-sm">
              了解项目认领
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
