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
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/projects/${encodeURIComponent(p.slug)}`}
                className="text-sm font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
              >
                {p.name}
              </Link>
              {p.primaryCategory?.trim() ? (
                <span className="ml-2 text-[10px] text-violet-600 dark:text-violet-400">
                  {p.primaryCategory}
                </span>
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
      className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
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
