import Link from "next/link"
import { redirect } from "next/navigation"

import { readLaunchPlansLatestFirst } from "@/agents/growth/launch-plan-store"
import { auth } from "@/auth"

import { ExternalPostGenerator } from "@/components/growth/external-post-generator"

import {
  approveLaunchPlanAction,
  publishLaunchPlanAction,
  queueLaunchPlanAction,
} from "./actions"

export const dynamic = "force-dynamic"

function targetLabel(t: string): string {
  switch (t) {
    case "site_feature":
      return "站内精选"
    case "site_feed":
      return "站内动态流"
    case "site_digest":
      return "站内摘要"
    default:
      return t
  }
}

export default async function LaunchDashboardPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard/launch")
  }

  const plans = await readLaunchPlansLatestFirst().catch(() => [])

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
          <Link href="/dashboard" className="underline-offset-4 hover:underline">
            我的项目
          </Link>
          <span className="text-zinc-300">·</span>
          <Link href="/dashboard/growth" className="underline-offset-4 hover:underline">
            增长中心
          </Link>
          <span className="text-zinc-300">·</span>
          <Link href="/dashboard/content-drafts" className="underline-offset-4 hover:underline">
            内容草稿
          </Link>
        </p>

        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Launch 站内发布</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Growth Launch V1：LaunchPlan 状态机（draft → approved → queued → published）与站内
            SiteContent 落盘。不连接外站 API。
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            演示完整链路可运行{" "}
            <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">pnpm launch:demo</code>
          </p>
        </header>

        {plans.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
            <p>暂无发布计划。请先完成 Handoff 并接受 candidate，再运行</p>
            <p className="mt-2 font-mono text-xs">pnpm launch:demo</p>
            <p className="mt-2">或在本地用 API/脚本创建 LaunchPlan。</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {plans.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{p.title}</h2>
                  <time className="text-xs text-zinc-500 tabular-nums" dateTime={p.createdAt}>
                    {p.createdAt.replace("T", " ").slice(0, 19)}
                  </time>
                </div>
                <p className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">状态：{p.status}</span>
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    目标：{p.targets.map(targetLabel).join("、")}
                  </span>
                  <span className="text-zinc-400">plan: {p.id}</span>
                </p>
                {p.summary ? (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">摘要：</span>
                    {p.summary.slice(0, 240)}
                    {p.summary.length > 240 ? "…" : ""}
                  </p>
                ) : null}
                {p.siteContentId ? (
                  <p className="mt-2 text-xs text-teal-600 dark:text-teal-400">已发布 siteContent: {p.siteContentId}</p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {p.status === "draft" ? (
                    <form action={approveLaunchPlanAction.bind(null, p.id)}>
                      <button
                        type="submit"
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                      >
                        审核通过
                      </button>
                    </form>
                  ) : null}
                  {p.status === "approved" ? (
                    <form action={queueLaunchPlanAction.bind(null, p.id)}>
                      <button
                        type="submit"
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                      >
                        加入发布队列
                      </button>
                    </form>
                  ) : null}
                  {p.status === "queued" ? (
                    <form action={publishLaunchPlanAction.bind(null, p.id)}>
                      <button
                        type="submit"
                        className="rounded-lg border border-teal-600/60 bg-teal-600/10 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-600/20 dark:border-teal-500/50 dark:text-teal-200"
                      >
                        发布到站内
                      </button>
                    </form>
                  ) : null}
                  {p.status === "published" && p.siteContentId ? (
                    <ExternalPostGenerator siteContentId={p.siteContentId} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
