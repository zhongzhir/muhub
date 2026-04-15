/**
 * 首页 FAQ：压缩为 3-4 条折叠问答
 */
export default function GeoFaq() {
  return (
    <section
      className="border-t border-zinc-200/80 bg-zinc-50/30 py-14 dark:border-zinc-800 dark:bg-zinc-950/40"
      aria-labelledby="home-faq-heading"
    >
      <div className="mx-auto max-w-3xl px-4">
        <h2
          id="home-faq-heading"
          className="text-center text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          常见问题
        </h2>

        <div className="mt-8 space-y-3">
          <details className="group rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              什么是木哈布 MUHUB？
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              MUHUB 是项目展示与动态聚合平台，帮助你把公开信息集中到一个可持续更新的项目主页。
            </p>
          </details>

          <details className="group rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              平台上的信息来自哪里？
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              主要来自公开项目资料与公开动态，包括代码仓库、官网和项目维护者补充的信息。
            </p>
          </details>

          <details className="group rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              可以认领或完善自己的项目吗？
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              可以，认领与入驻流程正在逐步开放。你可以先通过页面下方入口提交认领意向。
            </p>
          </details>

          <details className="group rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              适合哪些人使用？
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              适合关注 AI/科技项目的用户、项目维护者，以及需要跟踪项目公开进展的运营与合作团队。
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}
