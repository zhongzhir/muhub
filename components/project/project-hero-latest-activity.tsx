type LatestActivity = {
  title: string;
  type: "release" | "star" | "update";
  occurredAt: string;
};

function typeLabel(type: LatestActivity["type"]): string {
  if (type === "release") return "Release";
  if (type === "star") return "Stars";
  return "Update";
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
        Latest Activity · {typeLabel(activity.type)}
      </p>
      <p className="mt-1 text-zinc-800 dark:text-zinc-200">{activity.title}</p>
    </div>
  );
}
