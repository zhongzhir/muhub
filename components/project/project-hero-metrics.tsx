import { formatRelativeUpdateTime, getProjectActivityStatus } from "@/lib/project/project-recency";

type Props = {
  stars?: number;
  updatedAt?: string | Date | null;
  contributors?: number;
};

export default function ProjectHeroMetrics({ stars, updatedAt, contributors }: Props) {
  const updatedText = formatRelativeUpdateTime(updatedAt);
  const activityStatus = getProjectActivityStatus(updatedAt);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-zinc-400">
      {stars ? <div>⭐ {stars.toLocaleString()} stars</div> : null}

      {updatedText ? <div>🔄 {updatedText}</div> : null}

      {contributors ? <div>👥 {contributors} contributors</div> : null}

      {activityStatus ? (
        <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
          {activityStatus}
        </span>
      ) : null}
    </div>
  );
}
