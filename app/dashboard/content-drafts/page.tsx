import Link from "next/link";
import { redirect } from "next/navigation";
import { readContentDraftsLatestFirst } from "@/agents/content/content-draft-store";
import type { ContentChannel, ContentDraftType } from "@/agents/content/content-types";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

function typeLabel(t: ContentDraftType): string {
  switch (t) {
    case "project-roundup":
      return "项目推荐汇总";
    case "trend-observation":
      return "趋势观察";
    case "project-spotlight":
      return "单项目解读";
    case "social-post":
      return "社媒短帖";
    default:
      return t;
  }
}

function channelLabel(c: ContentChannel): string {
  switch (c) {
    case "article":
      return "长文/通用";
    case "wechat":
      return "微信";
    case "xiaohongshu":
      return "小红书";
    case "x":
      return "X";
    case "community":
      return "社群";
    default:
      return c;
  }
}

export default async function ContentDraftsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard/content-drafts");
  }

  let drafts: Awaited<ReturnType<typeof readContentDraftsLatestFirst>> = [];
  try {
    drafts = await readContentDraftsLatestFirst();
  } catch {
    drafts = [];
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
          <Link href="/dashboard" className="underline-offset-4 hover:underline">
            我的项目
          </Link>
          <span className="text-zinc-300">·</span>
          <Link href="/" className="underline-offset-4 hover:underline">
            首页
          </Link>
        </p>

        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">内容草稿</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            V1.2 内部运营视图：展示 Content Agent
            模板生成的草稿（存于本地 JSON，未接社媒发布）。可复制正文后到外站编辑发布。
          </p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
            生成更多草稿可运行{" "}
            <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">pnpm content:generation</code>
          </p>
        </header>

        {drafts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
            <p>暂无草稿。请在仓库根目录运行</p>
            <p className="mt-2 font-mono text-xs">pnpm content:generation</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {drafts.map((d) => (
              <li
                key={d.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{d.title}</h2>
                  <time className="text-xs text-zinc-500 tabular-nums" dateTime={d.generatedAt}>
                    {d.generatedAt.replace("T", " ").slice(0, 19)}
                  </time>
                </div>
                <p className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    {typeLabel(d.type)}
                  </span>
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    {channelLabel(d.channel)}
                  </span>
                  <span className="text-zinc-400">id: {d.id}</span>
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">状态：{d.status}</span>
                  {typeof d.qualityScore === "number" ? (
                    <span className="text-zinc-400">质检分：{d.qualityScore}</span>
                  ) : null}
                </p>
                {d.summary ? (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">摘要：</span>
                    {d.summary}
                  </p>
                ) : null}
                <details className="mt-3 group">
                  <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                    展开正文（纯文本）
                  </summary>
                  <pre className="mt-3 max-h-[min(28rem,55vh)] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-3 text-sm text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                    {d.body}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
