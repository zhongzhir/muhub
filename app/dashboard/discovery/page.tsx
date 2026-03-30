import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listPendingDiscoveredProjectCandidates } from "@/lib/discovery-candidates";
import { buildDiscoveryImportPath } from "@/lib/discovery-import-path";
import { DiscoveryCandidateRow } from "./discovery-candidate-row";

export const dynamic = "force-dynamic";

export default async function DiscoveryDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard/discovery");
  }

  const candidates = await listPendingDiscoveredProjectCandidates();
  const hasDb = Boolean(process.env.DATABASE_URL?.trim());

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
          <span className="text-zinc-300">·</span>
          <Link href="/dashboard" className="underline-offset-4 hover:underline">
            我的项目
          </Link>
          <span className="text-zinc-300">·</span>
          <Link href="/projects" className="underline-offset-4 hover:underline">
            项目广场
          </Link>
        </p>

        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">自动发现</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            候选项目来自 GitHub 搜索脚本，未自动上架。请筛选后跳转创建页预填入库，或标记丢弃。
          </p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
            运行脚本：
            <code className="rounded bg-zinc-200/80 px-1.5 py-0.5 text-[11px] dark:bg-zinc-800">
              pnpm discovery:run
            </code>
          </p>
        </header>

        {!hasDb ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            未配置 DATABASE_URL，无法列出候选。
          </p>
        ) : candidates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
            暂无 pending 候选。请在配置 GITHUB_TOKEN 后执行{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">pnpm discovery:run</code>。
          </p>
        ) : (
          <ul className="space-y-4">
            {candidates.map((c) => (
              <li key={c.id}>
                <DiscoveryCandidateRow
                  candidate={{
                    id: c.id,
                    source: c.source,
                    name: c.name,
                    description: c.description,
                    ownerName: c.ownerName,
                    stars: c.stars,
                    primaryLanguage: c.primaryLanguage,
                    lastPushedAt: c.lastPushedAt?.toISOString() ?? null,
                    repoUrl: c.repoUrl,
                    homepageUrl: c.homepageUrl,
                    isChineseRelated: c.isChineseRelated,
                    importHref: buildDiscoveryImportPath({
                      id: c.id,
                      name: c.name,
                      description: c.description,
                      repoUrl: c.repoUrl,
                      homepageUrl: c.homepageUrl,
                    }),
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
