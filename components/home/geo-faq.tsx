/**
 * 首页 GEO 第二阶段：低调 FAQ（语义化 section / h2 / h3）
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

        <div className="mt-10 space-y-8">
          <article>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">什么是木哈布 MUHUB？</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              木哈布 MUHUB 是面向创业项目与产品的 <span className="whitespace-nowrap">AI Native</span>{" "}
              项目主页与动态聚合平台，帮助你把仓库、官网与公开进展集中到一页，便于对外展示与分享。
            </p>
          </article>

          <article>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">谁适合使用 MUHUB？</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              早期团队、独立开发者、需要向投资人或合作方持续同步进展的项目负责人，以及希望统一展示 GitHub
              / Gitee 与多源动态的社区项目，都可以使用 MUHUB 作为主分享入口。
            </p>
          </article>

          <article>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">MUHUB 支持哪些项目来源？</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              支持从 <strong className="font-medium text-zinc-700 dark:text-zinc-300">GitHub</strong>、
              <strong className="font-medium text-zinc-700 dark:text-zinc-300">Gitee</strong>{" "}
              导入或完全手工创建；可配置官网、文档、博客等信息源，并与手动动态、AI 摘要等一并展示。
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
