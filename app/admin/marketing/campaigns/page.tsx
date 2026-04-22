import Link from "next/link";
import { fetchMarketingProjectSnippet } from "@/lib/admin-marketing-context";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function qp(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminMarketingCampaignsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
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
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">营销活动</h1>
        {!project ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">占位页：后续可配置渠道、排期与投放状态。</p>
        ) : (
          <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              项目：<span className="font-medium text-zinc-900 dark:text-zinc-100">{project.name}</span>
            </p>
            <p>
              状态 {project.status} · 可见性 {project.visibilityStatus}
            </p>
            <p>{project.tagline || "暂无一句话简介"}</p>
            <p>建议后续动作：</p>
            <ul className="list-inside list-disc space-y-1">
              <li>先在「项目海报」确认对外展示文案与链接。</li>
              <li>在「推广文案」生成渠道版本后再发起活动。</li>
              <li>后续版本在本页补充渠道、排期和投放状态追踪。</li>
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
