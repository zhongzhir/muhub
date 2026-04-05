import type { SiteContent } from "@/agents/growth/launch-plan-types"

import { contentStreamTypeLabel } from "@/components/content/content-list"

function formatPublished(iso: string): string {
  try {
    return iso.replace("T", " ").slice(0, 19)
  } catch {
    return iso
  }
}

/**
 * 项目详情页：与 `relatedProjectIds` 匹配的 SiteContent（仅展示，无推荐/排序算法）。
 */
export function ProjectRelatedContent({ items }: { items: SiteContent[] }) {
  if (items.length === 0) {
    return null
  }

  return (
    <section
      className="muhub-card mt-10 border-zinc-200/90 p-6 dark:border-zinc-700/90"
      aria-labelledby="project-related-content-heading"
    >
      <h2
        id="project-related-content-heading"
        className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
      >
        Related Content
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        MUHUB 站内内容流中与本项目关联的条目（按发布时间倒序）。
      </p>
      <ul className="mt-6 divide-y divide-zinc-200 dark:divide-zinc-800">
        {items.map((item) => (
          <li key={item.id} className="py-4 first:pt-0 last:pb-0">
            <p className="font-medium text-zinc-900 dark:text-zinc-50">{item.title}</p>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                {contentStreamTypeLabel(item.contentType)}
              </span>
              <time className="tabular-nums" dateTime={item.publishedAt}>
                {formatPublished(item.publishedAt)}
              </time>
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
