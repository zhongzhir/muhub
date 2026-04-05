import Link from "next/link"

import { readSiteContentLatestFirst } from "@/agents/growth/site-content-store"
import { ContentList } from "@/components/content/content-list"

export const dynamic = "force-dynamic"

export default async function ContentStreamPage() {
  const items = await readSiteContentLatestFirst()

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

        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">MUHUB 内容流</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            来自 Growth Launch 站内发布的素材（site-content），按发布时间倒序。无评论与分页。
          </p>
        </header>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
            <p>暂无已发布内容。</p>
            <p className="mt-2">
              可在仓库运行{" "}
              <code className="rounded bg-zinc-200/80 px-1 font-mono text-xs dark:bg-zinc-800">pnpm launch:demo</code>{" "}
              或通过 Dashboard Launch 发布后刷新本页。
            </p>
          </div>
        ) : (
          <ContentList items={items} />
        )}
      </div>
    </div>
  )
}
