import Link from "next/link";
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
  release: "Release",
  star: "Stars",
  update: "Update",
};

type RecentProjectActivitySectionProps = {
  activities: ProjectActivity[];
  title?: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
};

export function RecentProjectActivitySection({
  activities,
  title = "Recent Project Activity",
  subtitle = "平台最近项目动态（GitHub）",
  actionHref = "/projects?sort=updated",
  actionLabel = "查看全部动态",
}: RecentProjectActivitySectionProps) {
  if (activities.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-zinc-200/80 py-14 dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {title}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>
          </div>
          <Link
            href={actionHref}
            className="text-sm font-medium text-teal-700 underline-offset-4 hover:underline dark:text-teal-400"
          >
            {actionLabel}
          </Link>
        </div>

        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {activities.map((item) => (
            <li key={item.id} className="px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${badgeClass(item.type)}`}>
                      {typeLabel[item.type]}
                    </span>
                    <Link
                      href={`/projects/${encodeURIComponent(item.projectSlug)}`}
                      className="text-sm font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                    >
                      {item.projectName?.trim() || item.projectSlug}
                    </Link>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatDate(item.occurredAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{item.title}</p>
                  {item.summary ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">{item.summary}</p>
                  ) : null}
                </div>
                <div className="shrink-0">
                  <Link
                    href={`/projects/${encodeURIComponent(item.projectSlug)}`}
                    className="text-xs font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
                  >
                    查看项目
                  </Link>
                  {item.githubUrl ? (
                    <a
                      href={item.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-3 text-xs text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
                    >
                      GitHub
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
