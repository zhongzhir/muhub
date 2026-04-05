import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ContentSubscriptionRow } from "@/components/content/content-subscription-row";
import { listContentSubscriptionsForUser } from "@/lib/content/subscription-store";

export const dynamic = "force-dynamic";

export default async function ContentSubscriptionsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/me/subscriptions");
  }

  const rows = await listContentSubscriptionsForUser(session.user.id);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            首页
          </Link>
          <span className="text-zinc-300">·</span>
          <Link href="/projects" className="underline-offset-4 hover:underline">
            项目广场
          </Link>
          <span className="text-zinc-300">·</span>
          <Link href="/dashboard/following" className="underline-offset-4 hover:underline">
            我关注的项目（Dashboard）
          </Link>
        </p>

        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">项目内容订阅</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            你在项目页主动点击「Follow Project」形成的订阅关系；列表按订阅时间倒序，不包含推荐、算法排序或 AI。
          </p>
        </header>

        {rows.length === 0 ? (
          <div
            className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center dark:border-zinc-600 dark:bg-zinc-900/40"
            data-testid="subscriptions-empty"
          >
            <p className="text-base font-medium text-zinc-800 dark:text-zinc-200">暂无订阅</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
              在任意项目详情页使用「Follow Project」即可在此处查看与管理。
            </p>
            <Link
              href="/projects"
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              去项目广场
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map((row) => (
              <li key={row.id}>
                <ContentSubscriptionRow row={row} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
