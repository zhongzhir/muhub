import Link from "next/link"

import { buildContentStreamHref, type ContentStreamTabId } from "@/lib/content/content-stream-filter"

const TABS: { id: ContentStreamTabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "spotlight", label: "Spotlight" },
  { id: "updates", label: "Updates" },
  { id: "digest", label: "Digest" },
  { id: "topics", label: "Topics" },
]

/**
 * 内容流分类 Tab：仅切换 query，不改变排序逻辑（仍由数据侧 publishedAt DESC 决定）。
 */
export function ContentStreamTabs({ active, searchQuery }: { active: ContentStreamTabId; searchQuery?: string }) {
  return (
    <nav
      className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800"
      aria-label="内容类型分类"
    >
      {TABS.map((tab) => {
        const href = buildContentStreamHref(tab.id, searchQuery)
        const isActive = active === tab.id
        return (
          <Link
            key={tab.id}
            href={href}
            scroll={false}
            className={
              isActive
                ? "rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "rounded-lg border border-transparent px-3 py-1.5 text-sm font-medium text-zinc-600 hover:border-zinc-200 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
            }
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
