import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { readSiteContentLatestFirst } from "@/agents/growth/site-content-store"
import { ContentList } from "@/components/content/content-list"
import { filterSiteContentBySubscribedProjectSlugs } from "@/lib/content/content-stream-filter"
import { listContentSubscriptionsForUser } from "@/lib/content/subscription-store"

export const dynamic = "force-dynamic"

export default async function ContentFollowingFeedPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/content/following")
  }

  const subs = await listContentSubscriptionsForUser(session.user.id)
  const projectSlugs = subs.map((s) => s.projectSlug)
  const allLatest = await readSiteContentLatestFirst()
  const items = filterSiteContentBySubscribedProjectSlugs(allLatest, projectSlugs)

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="mb-6 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
          <span className="mx-2 text-zinc-300">·</span>
          <Link href="/content" className="underline-offset-4 hover:underline">
            全部内容
          </Link>
          <span className="mx-2 text-zinc-300">·</span>
          <Link href="/me/subscriptions" className="underline-offset-4 hover:underline">
            管理订阅
          </Link>
        </p>

        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">订阅项目动态</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            仅展示你已订阅项目中、站内已发布且稿件关联了对应项目 slug 的内容；按发布时间倒序，无推荐或额外排序权重。
          </p>
        </header>

        {projectSlugs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
            <p>你还没有订阅任何项目。</p>
            <p className="mt-2">
              在项目详情页点击 <span className="font-medium">关注项目</span>，或前往{" "}
              <Link href="/me/subscriptions" className="underline-offset-2 hover:underline">
                管理订阅
              </Link>
              。
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
            <p>暂无与订阅项目关联的已发布内容。</p>
            <p className="mt-2 text-xs text-zinc-500">
              Spotlight / 项目汇总类稿件发布后需带关联项目 slug 才会出现在此处。
            </p>
          </div>
        ) : (
          <ContentList items={items} />
        )}
      </div>
    </div>
  )
}
