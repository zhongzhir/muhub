export default function Features() {
  return (
    <section className="border-t border-zinc-200/80 py-20 dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Beta 已支持的能力
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-zinc-600 dark:text-zinc-400">
          不限于「挂一个 GitHub 链接」：多源信息、动态时间线与 AI 辅助摘要，一张名片讲清项目在做什么。
        </p>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">项目名片与分享页</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              统一展示简介、标签、仓库快照与亮点叙事；分享页面向对外介绍场景优化，指标后置。
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">信息源与动态聚合</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              GitHub / Gitee、官网、文档、博客与社媒条目合并展示；支持信息源抓取与多类型项目动态。
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">AI 摘要与 API</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              AI 项目摘要卡、动态摘要、Weekly Summary；开放{" "}
              <code className="rounded bg-zinc-200/80 px-1 text-xs dark:bg-zinc-800">/api/ai/project</code>{" "}
              按仓库地址返回结构化 JSON。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
