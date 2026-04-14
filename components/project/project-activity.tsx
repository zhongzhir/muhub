import type { ProjectActivity } from "@/agents/activity/project-activity-store";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString("zh-CN", { hour12: false });
}

function badgeClass(type: ProjectActivity["type"]): string {
  if (type === "release") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  }
  if (type === "star") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  }
  return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
}

const typeLabel: Record<ProjectActivity["type"], string> = {
  release: "release",
  star: "star",
  update: "update",
};

export function ProjectActivitySection({ activities }: { activities: ProjectActivity[] }) {
  if (activities.length === 0) {
    return (
      <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">Project Activity</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">暂无 GitHub Activity 记录。</p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold">Project Activity</h2>
      <ul className="mt-3 space-y-2">
        {activities.map((row) => (
          <li key={row.id} className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${badgeClass(row.type)}`}>
                {typeLabel[row.type]}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatDate(row.occurredAt)}</span>
            </div>
            <p className="mt-1 text-sm font-medium">{row.title}</p>
            {row.summary ? (
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{row.summary}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
