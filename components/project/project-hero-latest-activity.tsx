type LatestActivity = {
  title: string;
  type:
    | "project_imported"
    | "project_profile_updated"
    | "github_repo_updated"
    | "github_release_detected"
    | "official_update_detected";
  occurredAt: string;
};

function typeLabel(type: LatestActivity["type"]): string {
  if (type === "project_imported") return "新收录";
  if (type === "project_profile_updated") return "资料更新";
  if (type === "github_repo_updated") return "仓库更新";
  if (type === "github_release_detected") return "版本发布";
  return "官方更新";
}

export default function ProjectHeroLatestActivity({
  activity,
}: {
  activity?: LatestActivity | null;
}) {
  if (!activity) return null;

  return (
    <div className="mt-3 rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        最新动态 · {typeLabel(activity.type)}
      </p>
      <p className="mt-1 text-zinc-800 dark:text-zinc-200">{activity.title}</p>
    </div>
  );
}
