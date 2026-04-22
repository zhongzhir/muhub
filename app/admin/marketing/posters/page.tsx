import Link from "next/link";
import { fetchMarketingProjectSnippet } from "@/lib/admin-marketing-context";
import { PosterTools } from "./poster-tools";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function qp(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminMarketingPostersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const projectId = qp(sp, "projectId")?.trim();
  const project = projectId ? await fetchMarketingProjectSnippet(projectId) : null;

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        <Link href={projectId ? `/admin/marketing?projectId=${encodeURIComponent(projectId)}` : "/admin/marketing"} className="underline-offset-4 hover:underline">
          ← 营销中心
        </Link>
      </p>
      <section className="muhub-card space-y-3 p-6">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">项目海报</h1>
        {!project ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">请先从营销中心传入 `projectId`，再生成海报预览。</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">已选择项目：{project.name}</p>
            <PosterTools projectId={project.id} filename={`${project.slug}-poster`} />
            <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60">
              <div className="bg-gradient-to-r from-violet-600 to-cyan-500 px-6 py-5 text-white">
                <p className="text-xs uppercase tracking-[0.14em] text-white/90">MUHUB Project Poster</p>
                <h2 className="mt-2 text-3xl font-semibold">{project.name}</h2>
                <p className="mt-2 text-sm text-white/95">{project.tagline || "探索这个项目的核心能力与应用场景。"}</p>
              </div>
              <div className="space-y-4 px-6 py-5">
                <div className="flex flex-wrap gap-2 text-xs">
                  {project.primaryCategory ? <span className="rounded-full bg-zinc-900 px-2 py-1 text-white dark:bg-zinc-100 dark:text-zinc-900">{project.primaryCategory}</span> : null}
                {project.tags.slice(0, 5).map((tag) => (
                  <span key={tag} className="rounded-full border border-zinc-300 bg-white/70 px-2 py-1 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-300">
                    #{tag}
                  </span>
                ))}
                  {project.tags.length === 0 ? <span className="text-zinc-500">暂无标签</span> : null}
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
                  {project.websiteUrl || project.githubUrl || "请在项目编辑页补充官网或 GitHub 链接"}
                </div>
                <p className="text-[11px] text-zinc-500">状态：{project.status} · 可见性：{project.visibilityStatus}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500">当前为 HTML 预览版，支持打印和下载（HTML）。</p>
          </div>
        )}
      </section>
    </div>
  );
}
