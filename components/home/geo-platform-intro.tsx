/**
 * 首页 GEO：平台语义简介（独立区块，样式与全站一致）
 */
export default function GeoPlatformIntro() {
  return (
    <section
      className="border-t border-zinc-200/80 bg-zinc-50/40 py-16 dark:border-zinc-800 dark:bg-zinc-950/50"
      aria-labelledby="geo-what-heading"
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl space-y-12">
          <article>
            <h2
              id="geo-what-heading"
              className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            >
              什么是 MUHUB
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              木哈布 MUHUB 是 AI Native
              的项目展示与动态聚合平台：把仓库、官网与公开动态收进同一页，帮助团队用一张「项目主页」讲清在做什么、进展如何，并面向合作方、投资人与用户展示。
            </p>
          </article>

          <article aria-labelledby="geo-who-heading">
            <h2
              id="geo-who-heading"
              className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            >
              谁适合使用 MUHUB
            </h2>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              <li>需要向外界持续展示进展的早期创业团队与独立开发者</li>
              <li>开源 / 闭源项目希望统一展示仓库指标、动态与时间线</li>
              <li>需要从 GitHub、Gitee 或手工维护多源信息的产品与市场负责人</li>
            </ul>
          </article>

          <article aria-labelledby="geo-core-heading">
            <h2
              id="geo-core-heading"
              className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            >
              MUHUB 的核心能力
            </h2>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              <li>项目名片与可分享的公开主页</li>
              <li>多源信息聚合与项目动态时间线</li>
              <li>AI 摘要与周期性总结（按项目配置启用）</li>
              <li>与 GitHub / Gitee 等代码托管导入或手工维护</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
