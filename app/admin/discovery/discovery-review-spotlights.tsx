import Link from "next/link";
import { mergeAdminCandidateListUrl } from "@/lib/discovery/admin-candidate-list-url";
import type { DiscoverySpotlightItem } from "@/lib/discovery/discovery-review-spotlights";

function Block({
  title,
  subtitle,
  items,
  empty,
}: {
  title: string;
  subtitle: string;
  items: DiscoverySpotlightItem[];
  empty: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h3>
      <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-400">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={`/admin/discovery/${it.id}`}
                className="text-sm font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
              >
                {it.title}
              </Link>
              <span className="ml-2 tabular-nums text-[10px] text-violet-600 dark:text-violet-400">
                pri {it.reviewPriorityScore.toFixed(0)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DiscoveryReviewSpotlights(props: {
  worthFirst: DiscoverySpotlightItem[];
  multiSource: DiscoverySpotlightItem[];
  wellFilled: DiscoverySpotlightItem[];
  lowCleanup: DiscoverySpotlightItem[];
}) {
  const { worthFirst, multiSource, wellFilled, lowCleanup } = props;
  const lowHref = mergeAdminCandidateListUrl(new URLSearchParams(), {
    lowSignal: "1",
    reviewStatus: "PENDING",
    page: "1",
  });

  return (
    <section
      className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20"
      aria-labelledby="discovery-spotlights-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2
          id="discovery-spotlights-heading"
          className="text-sm font-semibold text-indigo-950 dark:text-indigo-100"
        >
          推荐审核视图
        </h2>
        <Link
          href={lowHref}
          className="text-xs font-medium text-indigo-800 underline-offset-2 hover:underline dark:text-indigo-300"
        >
          一键筛：低信号待清理
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Block
          title="值得优先审核"
          subtitle="按审核优先级分排序的待办前列"
          items={worthFirst}
          empty="暂无待办或请先批量重算优先级"
        />
        <Block
          title="多来源候选"
          subtitle="GitHub + Product Hunt 等融合信号"
          items={multiSource}
          empty="暂无非单来源候选"
        />
        <Block
          title="信息较完整"
          subtitle="高优先级且具备官网/仓库等"
          items={wellFilled}
          empty="暂无"
        />
        <Block
          title="低质量待清理"
          subtitle="分低且无有效链接/描述，可批量 Ignore"
          items={lowCleanup}
          empty="暂无匹配"
        />
      </div>
    </section>
  );
}
