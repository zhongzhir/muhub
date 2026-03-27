/**
 * Beta 阶段信任说明（克制、非营销腔）：首页底部 / 反馈页可复用
 */
export function BetaTrustStrip() {
  return (
    <aside
      className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-4 py-4 text-center dark:border-zinc-700 dark:bg-zinc-900/40"
      aria-label="Beta 与平台说明"
    >
      <p className="mx-auto max-w-2xl text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        木哈布 MUHUB 当前为 <span className="font-medium text-zinc-700 dark:text-zinc-300">Beta</span>
        ，支持从 GitHub / Gitee 导入与手工维护项目主页；我们欢迎项目方、合作方、投资人与开发者试用，并会持续改进稳定性与能力。
      </p>
    </aside>
  );
}
