import Link from "next/link";
import type { ProjectListItem } from "@/lib/project-list";

function MiniList({
  title,
  items,
  empty,
}: {
  title: string;
  items: ProjectListItem[];
  empty: string;
}) {
  return (
    <div className="muhub-card p-4 sm:p-5">
      <h3 className="muhub-form-legend mb-0 text-left">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((p) => (
            <li key={p.slug} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Link
                href={`/projects/${encodeURIComponent(p.slug)}`}
                className="text-sm font-semibold text-teal-800 underline-offset-2 hover:underline dark:text-teal-300"
              >
                {p.name}
              </Link>
              {p.primaryCategory?.trim() ? (
                <span className="muhub-badge muhub-badge--category">{p.primaryCategory}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PlazaDiscoveryBlocks(props: {
  hotAgents: ProjectListItem[];
  chineseAi: ProjectListItem[];
  recentDiscovered: ProjectListItem[];
  wellFilled: ProjectListItem[];
}) {
  const { hotAgents, chineseAi, recentDiscovered, wellFilled } = props;
  return (
    <section
      aria-label="发现精选"
      className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      data-testid="plaza-discovery-blocks"
    >
      <MiniList title="热门 AI Agent" items={hotAgents} empty="暂无匹配公开项目" />
      <MiniList title="中文 AI 工具" items={chineseAi} empty="暂无匹配公开项目" />
      <MiniList
        title="最近发现"
        items={recentDiscovered}
        empty="暂无 Discovery 溯源项目"
      />
      <MiniList
        title="信息较完整"
        items={wellFilled}
        empty="暂无法排序展示"
      />
    </section>
  );
}
