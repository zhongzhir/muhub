import Link from "next/link"

import type { ProjectTimelineItem } from "@/lib/content/project-timeline"

function sourceLabel(t: ProjectTimelineItem["sourceType"]): string {
  switch (t) {
    case "project_update":
      return "项目更新"
    case "site_content":
      return "站内内容"
    default:
      return t
  }
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso.replace("T", " ").slice(0, 16)
  }
}

/**
 * 中立时间线：按时间聚合公开信息，不含评分、推荐或价值判断文案。
 */
export function ProjectTimeline({ items }: { items: ProjectTimelineItem[] }) {
  if (items.length === 0) {
    return null
  }

  return (
    <section
      className="muhub-card mt-10 border-zinc-200/90 p-6 dark:border-zinc-700/90"
      aria-labelledby="project-timeline-heading"
    >
      <h2
        id="project-timeline-heading"
        className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
      >
        Project Timeline
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        按时间归集的本项目相关公开信息与站内内容；仅作档案展示，不包含排序推荐或投资建议。
      </p>

      <ul className="mt-6 divide-y divide-zinc-200 dark:divide-zinc-800">
        {items.map((item) => (
          <li key={item.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <time className="tabular-nums" dateTime={item.occurredAt}>
                {formatWhen(item.occurredAt)}
              </time>
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{sourceLabel(item.sourceType)}</span>
            </div>
            <div className="mt-2">
              {item.href ? (
                item.href.startsWith("/") ? (
                  <Link
                    href={item.href}
                    className="font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
                  >
                    {item.title}
                  </Link>
                ) : (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
                  >
                    {item.title}
                    <span className="ml-0.5 text-zinc-400" aria-hidden>
                      ↗
                    </span>
                  </a>
                )
              ) : (
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{item.title}</span>
              )}
            </div>
            {item.summary ? (
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{item.summary}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
