import type { ProjectActivity } from "@/lib/activity/project-activity-service";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
}

function badgeClass(type: ProjectActivity["type"]): string {
  if (type === "github_release_detected") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (type === "project_imported") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
}

const typeLabel: Record<ProjectActivity["type"], string> = {
  project_imported: "项目已收录",
  project_profile_updated: "信息已更新",
  github_repo_updated: "仓库更新",
  github_release_detected: "版本发布",
  official_update_detected: "官方更新",
};

function publicTitle(row: ProjectActivity): string {
  const raw = row.title.trim();
  if (!raw || /^action:/i.test(raw)) {
    return row.type === "project_imported" ? "项目已收录到 MUHUB 项目库" : "项目信息已更新";
  }
  if (row.type === "project_imported") return "项目已收录到 MUHUB 项目库";
  if (raw.toLowerCase() === "publish" || raw.toLowerCase() === "project published") return "项目已发布";
  return raw;
}

function uniqueActivities(rows: ProjectActivity[]): ProjectActivity[] {
  const seen = new Set<string>();
  const out: ProjectActivity[] = [];
  for (const row of rows) {
    const key = row.type === "project_imported" ? "project_imported" : `${row.type}:${publicTitle(row)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export function ProjectActivitySection({ activities }: { activities: ProjectActivity[] }) {
  const rows = uniqueActivities(activities).slice(0, 4);
  if (rows.length === 0) return null;

  return (
    <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold">最新动态</h2>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${badgeClass(row.type)}`}>
                {typeLabel[row.type]}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatDate(row.occurredAt)}</span>
            </div>
            <p className="mt-1 text-sm font-medium">{publicTitle(row)}</p>
            {row.summary ? <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{row.summary}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
