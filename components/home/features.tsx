export default function Features() {
  return (
    <section className="border-t border-zinc-200/80 py-14 dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-7">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">平台能力</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">项目发现</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">持续收录公开项目并维护可浏览入口。</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">信息整理</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">聚合项目来源、动态更新与关键信息摘要。</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">公众展示</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">通过项目主页和分享页对外持续展示进展。</p>
          </div>
        </div>
      </div>
    </section>
  );
}
