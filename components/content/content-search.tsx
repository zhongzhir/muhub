import type { ContentStreamTabId } from "@/lib/content/content-stream-filter"

/**
 * GET /content?q=…&type=… 最小搜索；无联想、无向量、无推荐。
 */
export function ContentSearchForm({ tab, defaultQuery }: { tab: ContentStreamTabId; defaultQuery: string }) {
  return (
    <form action="/content" method="get" className="mb-8 mt-4">
      {tab !== "all" ? <input type="hidden" name="type" value={tab} /> : null}
      <label htmlFor="content-search-q" className="sr-only">
        搜索内容
      </label>
      <input
        id="content-search-q"
        name="q"
        type="search"
        placeholder="Search content..."
        defaultValue={defaultQuery}
        autoComplete="off"
        className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-teal-400"
      />
    </form>
  )
}
