import Link from "next/link";
import { redirect } from "next/navigation";
import { readBundlesLatestFirst } from "@/agents/growth/content-bundle-store";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

function PostList({ label, items }: { label: string; items?: string[] }) {
  if (!items?.length) {
    return null;
  }
  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
      <ol className="mt-1 list-decimal space-y-2 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
        {items.map((t, i) => (
          <li key={i}>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm">{t}</pre>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function GrowthCenterPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard/growth");
  }

  const bundles = await readBundlesLatestFirst().catch(() => []);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
          <Link href="/dashboard" className="underline-offset-4 hover:underline">
            我的项目
          </Link>
          <span className="text-zinc-300">·</span>
          <Link href="/dashboard/content-drafts" className="underline-offset-4 hover:underline">
            内容草稿
          </Link>
        </p>

        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">增长中心</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            V1.3 冷启动内容资产包：每包含 1 篇长文草稿（见内容草稿）+ 每渠道 3
            条短帖占位 + 1 条社群转发。规则生成，未接社媒 API。
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            生成/更新资产包请运行{" "}
            <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">pnpm growth:launch</code>
          </p>
        </header>

        {bundles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
            <p>暂无资产包。请在仓库根目录执行：</p>
            <p className="mt-2 font-mono text-xs">pnpm growth:launch</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {bundles.map((b) => (
              <li
                key={b.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{b.title}</h2>
                  <time className="text-xs text-zinc-500 tabular-nums" dateTime={b.createdAt}>
                    {b.createdAt.replace("T", " ").slice(0, 19)}
                  </time>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  bundle: {b.id}
                  {b.articleDraftId ? (
                    <>
                      {" · "}
                      文章草稿 id: {b.articleDraftId}
                    </>
                  ) : null}
                </p>

                {b.communityMessage ? (
                  <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="font-medium">社群转发：</span>
                  </p>
                ) : null}
                {b.communityMessage ? (
                  <pre className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-3 text-sm text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                    {b.communityMessage}
                  </pre>
                ) : null}

                <details className="mt-3 group">
                  <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                    展开社媒短帖（X / 小红书 / 微信场景）
                  </summary>
                  <div className="mt-3 space-y-4 rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                    <PostList label="X（3 条）" items={b.socialPosts.x} />
                    <PostList label="小红书（3 条）" items={b.socialPosts.xiaohongshu} />
                    <PostList label="微信生态 / 朋友圈话术（3 条）" items={b.socialPosts.wechat} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
