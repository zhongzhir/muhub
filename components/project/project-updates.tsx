import Link from "next/link";
import type { ProjectUpdateSourceType } from "@prisma/client";
import type { DemoUpdate } from "@/lib/demo-project";
import { buildProjectUpdateStreamModel } from "@/lib/project-updates";

export type ProjectUpdatesProps = {
  slug: string;
  updates: DemoUpdate[];
  fromDb: boolean;
  canManage: boolean;
};

function updateKindLabel(sourceType: ProjectUpdateSourceType): string | null {
  if (sourceType === "MANUAL") {
    return "动态";
  }
  if (sourceType === "OFFICIAL") {
    return "公告";
  }
  return null;
}

/** 列表与摘要预览用文字截断，避免极长空状态撑版 */
function truncateText(text: string, maxChars: number): string {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (t.length <= maxChars) {
    return t;
  }
  return `${t.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

export function ProjectUpdates({ slug, updates, fromDb, canManage }: ProjectUpdatesProps) {
  const showPublishCta = fromDb && canManage;
  const count = updates.length;

  return (
    <section
      id="project-updates"
      className="mt-10 scroll-mt-24"
      aria-labelledby="project-updates-heading"
      data-testid="project-updates-section"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2
            id="project-updates-heading"
            className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            项目动态
          </h2>
          {count > 0 ? (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">共 {count} 条 · 按发布时间倒序</p>
          ) : (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">进展与公告集中展示在此，便于对外沟通</p>
          )}
        </div>
      </div>

      {count === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 bg-gradient-to-b from-zinc-50/90 to-white px-6 py-12 text-center dark:border-zinc-700 dark:from-zinc-900/50 dark:to-zinc-900/80">
          <p className="text-base font-semibold text-zinc-800 dark:text-zinc-100">还没有项目动态</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            发布第一条动态，让访客了解版本发布、里程碑与日常进展。
          </p>
          {showPublishCta ? (
            <Link
              href={`/dashboard/projects/${slug}/updates/new`}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              发布第一条动态
            </Link>
          ) : (
            <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
              项目维护者登录后可在此发布动态；公开访客可持续查看已发布内容。
            </p>
          )}
        </div>
      ) : (
        <ul className="mt-6 space-y-5">
          {updates.map((u, i) => {
            const displayAt = u.createdAt ?? u.occurredAt;
            const stream = buildProjectUpdateStreamModel({
              sourceType: u.sourceType,
              sourceLabel: u.sourceLabel,
              isAiGenerated: u.isAiGenerated,
            });
            const kind = updateKindLabel(u.sourceType);
            const isFirst = i === 0;
            const contentMax = isFirst ? 480 : 300;
            const summaryMax = isFirst ? 360 : 220;

            return (
              <li
                key={u.id ?? `update-${u.title}-${displayAt.toISOString()}-${i}`}
                data-testid="project-update-item"
                className={`relative py-1 ${
                  isFirst
                    ? "rounded-2xl border border-zinc-200 bg-white px-4 py-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 sm:px-6"
                    : "border-l-2 border-zinc-200 pl-5 dark:border-zinc-700"
                }`}
              >
                {isFirst ? (
                  <span className="mb-4 inline-flex items-center rounded-full bg-zinc-900 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white dark:bg-zinc-100 dark:text-zinc-900">
                    最新动态
                  </span>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 gap-y-1">
                  <span data-testid="project-update-source-badge" className={stream.badgeClass}>
                    {stream.primaryLabel}
                  </span>
                  {stream.aiAugment ? (
                    <span data-testid="project-update-ai-badge" className={stream.aiAugment.className}>
                      {stream.aiAugment.label}
                    </span>
                  ) : null}
                  {kind ? (
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {kind}
                    </span>
                  ) : null}
                  <time
                    className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500"
                    dateTime={displayAt.toISOString()}
                  >
                    {displayAt.toLocaleString("zh-CN")}
                  </time>
                </div>
                <h3 className="mt-3 text-lg font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
                  {u.title}
                </h3>
                {u.content?.trim() ? (
                  <p
                    className={`mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 ${
                      isFirst ? "line-clamp-6" : "line-clamp-4"
                    }`}
                  >
                    {truncateText(u.content.trim(), contentMax)}
                  </p>
                ) : null}
                {u.summary?.trim() ? (
                  <p
                    className={`mt-3 text-sm leading-relaxed ${
                      u.isAiGenerated
                        ? "border-l-2 border-amber-400/80 pl-3 text-zinc-700 line-clamp-4 dark:border-amber-500/60 dark:text-zinc-300"
                        : "text-zinc-600 line-clamp-3 dark:text-zinc-400"
                    }`}
                    data-testid={u.isAiGenerated ? "project-update-ai-summary" : undefined}
                  >
                    {u.isAiGenerated ? (
                      <span className="font-semibold text-amber-900 dark:text-amber-200">AI 摘要：</span>
                    ) : null}
                    {truncateText(u.summary.trim(), summaryMax)}
                  </p>
                ) : null}
                {u.sourceUrl ? (
                  <a
                    href={u.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                  >
                    查看来源
                    <span aria-hidden>↗</span>
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
