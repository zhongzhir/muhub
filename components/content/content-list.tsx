import type { SiteContent } from "@/agents/growth/launch-plan-types"

export function contentStreamTypeLabel(t: SiteContent["contentType"]): string {
  switch (t) {
    case "project-spotlight":
      return "项目聚焦"
    case "project-roundup":
      return "项目汇总"
    case "trend-observation":
      return "趋势观察"
    case "social-post":
      return "短帖"
    default:
      return t
  }
}

function formatPublished(iso: string): string {
  try {
    return iso.replace("T", " ").slice(0, 19)
  } catch {
    return iso
  }
}

/**
 * 站内内容流列表（Growth Launch 发布的 SiteContent）。
 * 不含分页；由父组件控制条数（如首页取前 5 条）。
 */
export function ContentList({ items }: { items: SiteContent[] }) {
  if (items.length === 0) {
    return null
  }

  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li
          key={item.id}
          id={item.id}
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{item.title}</h3>
            <time className="text-xs tabular-nums text-zinc-500" dateTime={item.publishedAt}>
              {formatPublished(item.publishedAt)}
            </time>
          </div>
          <p className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
              {contentStreamTypeLabel(item.contentType)}
            </span>
            <span className="text-zinc-400">id: {item.id}</span>
          </p>
          {item.summary ? (
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{item.summary}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
