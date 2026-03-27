import Link from "next/link";

/**
 * 首页轻量 Beta 提示：不打断主视觉、无弹窗
 */
export default function BetaNotice() {
  return (
    <aside
      className="border-b border-amber-200/60 bg-amber-50/80 py-3 text-center dark:border-amber-900/40 dark:bg-amber-950/25"
      data-testid="home-beta-notice"
      aria-label="Beta 说明"
    >
      <p className="mx-auto max-w-3xl px-4 text-xs leading-relaxed text-amber-950/90 dark:text-amber-100/90">
        <span className="font-semibold">木哈布 Beta</span>
        <span className="mx-1.5 text-amber-800/50 dark:text-amber-200/40">·</span>
        已支持 GitHub / Gitee、多信息源聚合与 AI 摘要；欢迎用<strong className="font-medium">公开项目</strong>
        试用，数据与体验将持续迭代。
        <span className="mx-1.5 text-amber-800/50 dark:text-amber-200/40">·</span>
        <Link href="/feedback" className="font-medium underline-offset-2 hover:underline">
          反馈建议
        </Link>
        <span className="mx-1.5 text-amber-800/50 dark:text-amber-200/40">·</span>
        <Link href="/dashboard/projects/new" className="font-medium underline-offset-2 hover:underline">
          申请收录项目
        </Link>
      </p>
    </aside>
  );
}
