import Link from "next/link"

import { readSiteContentLatestFirst } from "@/agents/growth/site-content-store"
import { ContentList } from "@/components/content/content-list"
import { ContentSearchForm } from "@/components/content/content-search"
import { ContentStreamTabs } from "@/components/content/content-tabs"
import {
  filterSiteContentByKeyword,
  filterSiteContentByTab,
  parseContentSearchQuery,
  parseContentStreamTab,
} from "@/lib/content/content-stream-filter"

export const dynamic = "force-dynamic"

export default async function ContentStreamPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[]; q?: string | string[] }>
}) {
  const sp = await searchParams
  const tab = parseContentStreamTab(sp.type)
  const searchQuery = parseContentSearchQuery(sp.q)
  const allItems = await readSiteContentLatestFirst()
  const afterTab = filterSiteContentByTab(allItems, tab)
  const items = filterSiteContentByKeyword(afterTab, searchQuery)

  const emptyBecauseSearch = afterTab.length > 0 && items.length === 0 && searchQuery.length > 0

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="mb-6 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
          <span className="mx-2 text-zinc-300">·</span>
          <Link href="/projects" className="underline-offset-4 hover:underline">
            项目广场
          </Link>
        </p>

        <header className="mb-2">
          <h1 className="text-2xl font-semibold tracking-tight">MUHUB 内容流</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            来自 Growth Launch 站内发布的素材，按发布时间倒序。按稿型分类与关键词子串搜索均为用户主动操作，不含推荐或评分。
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            Updates 与 Digest 当前对应同一稿型 <span className="font-mono">project-roundup</span>
            （周报与多项目汇总）；若后续拆分 contentType，Tab 可单独命中而不改排序规则。
          </p>
        </header>

        <ContentStreamTabs active={tab} searchQuery={searchQuery || undefined} />

        <ContentSearchForm tab={tab} defaultQuery={searchQuery} />

        {allItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
            <p>暂无已发布内容。</p>
            <p className="mt-2">
              可在仓库运行{" "}
              <code className="rounded bg-zinc-200/80 px-1 font-mono text-xs dark:bg-zinc-800">pnpm launch:demo</code>{" "}
              或通过 Dashboard Launch 发布后刷新本页。
            </p>
          </div>
        ) : afterTab.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
            <p>该分类下暂无已发布内容。</p>
            <p className="mt-2">请切换 Tab 或清除搜索条件。</p>
          </div>
        ) : emptyBecauseSearch ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
            <p>
              未在标题或摘要中找到包含「<span className="font-medium text-zinc-800 dark:text-zinc-200">{searchQuery}</span>
              」的条目。
            </p>
            <p className="mt-2 text-xs text-zinc-500">搜索仅匹配子串，不改变时间排序。</p>
          </div>
        ) : (
          <ContentList items={items} />
        )}
      </div>
    </div>
  )
}
