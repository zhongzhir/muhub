import Link from "next/link";
import { fetchMarketingProjectSnippet } from "@/lib/admin-marketing-context";
import { MarketingCopyGenerator } from "./copy-generator";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function qp(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminMarketingCopyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
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
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">推广文案</h1>
        {!project ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">请先从营销中心传入 `projectId`，再生成规则文案。</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">项目：{project.name}</p>
            <MarketingCopyGenerator projectId={project.id} />
            <p className="text-xs text-zinc-500">文案生成为结构化输出，支持模板切换与快速复制。</p>
          </div>
        )}
      </section>
    </div>
  );
}
