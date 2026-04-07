import Link from "next/link";

import { readDiscoveryItems } from "@/agents/discovery/discovery-store";

import { DiscoveryJsonQueueTable } from "./discovery-json-queue-table";

export const dynamic = "force-dynamic";

export default async function AdminDiscoveryJsonQueuePage() {
  const items = await readDiscoveryItems();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/admin/discovery" className="underline-offset-4 hover:underline">
            ← Discovery 候选池（数据库）
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Discovery 队列（JSON · 基础版）</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          本地 <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-800">data/discovery-items.json</code>{" "}
          队列，用于最小闭环与后续导入衔接；本页不接 GitHub API、无自动抓取。
        </p>
      </header>

      <DiscoveryJsonQueueTable items={items} />
    </div>
  );
}
