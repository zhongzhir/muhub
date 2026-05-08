import { formatRelativeUpdateTime, getProjectActivityStatus } from "@/lib/project/project-recency";

type Props = {
  stars?: number;
  updatedAt?: string | Date | null;
  contributors?: number;
};

export default function ProjectHeroMetrics({ stars, updatedAt, contributors }: Props) {
  const updatedText = formatRelativeUpdateTime(updatedAt);
  const activityStatus = getProjectActivityStatus(updatedAt);
  const hasMetrics = stars || updatedText || contributors;

  if (!hasMetrics && !activityStatus) return null;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2.5">
      {stars ? (
        <div className="flex items-baseline gap-1.5 rounded-lg border border-white/10 bg-white/8 px-3 py-1.5">
          <span className="text-sm font-semibold tabular-nums text-white">
            {stars.toLocaleString()}
          </span>
          <span className="text-[10px] font-medium text-zinc-500">星标</span>
        </div>
      ) : null}

      {updatedText ? (
        <div className="flex items-baseline gap-1.5 rounded-lg border border-white/10 bg-white/8 px-3 py-1.5">
          <span className="text-sm font-semibold text-white">{updatedText}</span>
          <span className="text-[10px] font-medium text-zinc-500">更新</span>
        </div>
      ) : null}

      {contributors ? (
        <div className="flex items-baseline gap-1.5 rounded-lg border border-white/10 bg-white/8 px-3 py-1.5">
          <span className="text-sm font-semibold tabular-nums text-white">{contributors}</span>
          <span className="text-[10px] font-medium text-zinc-500">贡献者</span>
        </div>
      ) : null}

      {activityStatus ? (
        <div className="flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full bg-emerald-400"
            aria-hidden
          />
          <span className="text-[11px] font-medium text-emerald-300">{activityStatus}</span>
        </div>
      ) : null}
    </div>
  );
}
