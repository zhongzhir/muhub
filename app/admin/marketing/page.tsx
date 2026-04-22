import Link from "next/link";
import { fetchMarketingProjectSnippet } from "@/lib/admin-marketing-context";
import { readProjectActionLogs } from "@/lib/project-action-log";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function qp(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminMarketingHomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const projectId = qp(sp, "projectId")?.trim();
  const project = projectId ? await fetchMarketingProjectSnippet(projectId) : null;
  const marketingLogs = project ? await readProjectActionLogs(project.id, 20) : [];
  const hasCopyGenerated = marketingLogs.some(
    (item) => item.action === "marketing_generate" && (item.detail ?? "").includes("文案"),
  );
  const hasPosterGenerated = marketingLogs.some(
    (item) => item.action === "marketing_generate" && (item.detail ?? "").includes("海报"),
  );

  const withProject = (path: string) => (projectId ? `${path}?projectId=${encodeURIComponent(projectId)}` : path);

  return (
    <div className="space-y-8">
      <p className="text-sm text-zinc-500">
        <Link href="/admin" className="underline-offset-4 hover:underline">
          ← 后台总览
        </Link>
        {" · "}
        <Link href="/admin/projects" className="underline-offset-4 hover:underline">
          项目列表
        </Link>
      </p>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">项目营销中心</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">海报、推广文案与活动分发入口（最小可用版）。</p>
      </header>

      {project ? (
        <section className="muhub-card space-y-2 p-5">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">当前项目</h2>
          <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{project.name}</p>
          <p className="text-xs text-zinc-500">
            ID <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{project.id}</code>
            {" · "}
            slug <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{project.slug}</code>
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            状态 {project.status} · 可见性 {project.visibilityStatus}
          </p>
          <dl className="grid gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">一句话简介</dt>
              <dd>{project.tagline || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">分类</dt>
              <dd>{project.primaryCategory || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">标签</dt>
              <dd>{project.tags.length ? project.tags.map((tag) => `#${tag}`).join(" ") : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">官网 / GitHub</dt>
              <dd className="space-x-2">
                {project.websiteUrl ? (
                  <a href={project.websiteUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline dark:text-blue-400">
                    官网
                  </a>
                ) : null}
                {project.githubUrl ? (
                  <a href={project.githubUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline dark:text-blue-400">
                    GitHub
                  </a>
                ) : null}
                {!project.websiteUrl && !project.githubUrl ? "—" : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">文案已生成</dt>
              <dd>{hasCopyGenerated ? "是" : "否"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">海报已生成</dt>
              <dd>{hasPosterGenerated ? "是" : "否"}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link href={`/admin/projects/${project.id}/edit`} className="muhub-btn-secondary px-3 py-2 text-sm">
              返回项目编辑
            </Link>
            <Link href={`/projects/${project.slug}`} target="_blank" className="muhub-btn-secondary px-3 py-2 text-sm">
              前台预览
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          未指定项目。请从
          {" "}
          <Link href="/admin/projects" className="font-medium underline">
            项目列表
          </Link>
          或项目编辑页进入本中心（URL 需带 <code className="text-xs">?projectId=</code>）。
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">营销模块</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href={withProject("/admin/marketing/posters")}
            className="muhub-card block p-4 text-sm font-medium text-zinc-900 hover:border-zinc-400 dark:text-zinc-100 dark:hover:border-zinc-600"
          >
            项目海报
            <p className="mt-1 text-xs font-normal text-zinc-500">最小可用 · HTML 海报预览</p>
          </Link>
          <Link
            href={withProject("/admin/marketing/copy")}
            className="muhub-card block p-4 text-sm font-medium text-zinc-900 hover:border-zinc-400 dark:text-zinc-100 dark:hover:border-zinc-600"
          >
            推广文案
            <p className="mt-1 text-xs font-normal text-zinc-500">最小可用 · 规则文案拼装</p>
          </Link>
          <Link
            href={withProject("/admin/marketing/campaigns")}
            className="muhub-card block p-4 text-sm font-medium text-zinc-900 hover:border-zinc-400 dark:text-zinc-100 dark:hover:border-zinc-600"
          >
            营销活动
            <p className="mt-1 text-xs font-normal text-zinc-500">占位增强 · 带项目上下文</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
