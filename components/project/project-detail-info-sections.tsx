import type { ReactNode } from "react";
import { computeGithubActivity } from "@/lib/github-activity";
import type { ProjectPageView } from "@/lib/demo-project";
import { parseRepoUrl, repoPlatformDisplayLabel } from "@/lib/repo-platform";
import type { ProjectSourceDisplayItem } from "@/lib/project-sources";
import { mapSourceEmoji } from "@/lib/project-sources";
import { socialPlatformLabel } from "@/lib/social-platform";

type Props = {
  data: ProjectPageView;
  socials: ProjectPageView["socials"];
  sourceItems: ProjectSourceDisplayItem[];
  descriptionBody: string | null;
  /** 仅管理页传入「刷新仓库数据」表单等 */
  githubRefreshSlot?: ReactNode;
};

export function ProjectDetailInfoSections({
  data,
  socials,
  sourceItems,
  descriptionBody,
  githubRefreshSlot,
}: Props) {
  const showManageRepoActions = Boolean(githubRefreshSlot);
  return (
    <>
      {data.aiCardSummary?.trim() ? (
        <section
          className="mt-6 rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white px-6 py-5 shadow-sm dark:border-violet-900/40 dark:from-violet-950/35 dark:to-zinc-900 md:px-8"
          data-testid="project-ai-summary"
          aria-labelledby="project-ai-card-heading"
        >
          <h2
            id="project-ai-card-heading"
            className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300"
          >
            AI 项目摘要
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {data.aiCardSummary.trim()}
          </p>
        </section>
      ) : null}

      {data.aiWeeklySummary?.summary?.trim() ? (
        <section
          className="mt-6 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white px-6 py-5 shadow-sm dark:border-amber-900/40 dark:from-amber-950/30 dark:to-zinc-900 md:px-8"
          data-testid="project-ai-weekly-summary"
          aria-labelledby="project-ai-weekly-heading"
        >
          <h2
            id="project-ai-weekly-heading"
            className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200"
          >
            AI 周期性摘要
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            汇总窗口{" "}
            {data.aiWeeklySummary.startAt.toLocaleString("zh-CN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Shanghai",
            })}{" "}
            —{" "}
            {data.aiWeeklySummary.endAt.toLocaleString("zh-CN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Shanghai",
            })}
            <span className="mx-1 text-zinc-400">·</span>
            生成于{" "}
            {data.aiWeeklySummary.createdAt.toLocaleString("zh-CN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Shanghai",
            })}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {data.aiWeeklySummary.summary.trim()}
          </p>
        </section>
      ) : null}

      {data.tags && data.tags.length > 0 ? (
        <section
          className="mt-6 flex flex-wrap items-center gap-2"
          data-testid="project-tags"
          aria-labelledby="project-tags-heading"
        >
          <h2 id="project-tags-heading" className="text-xs font-medium text-zinc-500">
            项目标签
          </h2>
          <ul className="flex flex-wrap items-center gap-2">
            {data.tags.map((t) => (
              <li key={t}>
                <span className="inline-block rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200">
                  {t}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        className="mt-6 scroll-mt-8"
        aria-labelledby="project-tech-stack-heading"
        data-testid="project-tech-stack-section"
      >
        <h2
          id="project-tech-stack-heading"
          className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
        >
          技术栈
        </h2>
        {data.tags && data.tags.length > 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            与项目标签一致的技术与主题关键词：{data.tags.join("、")}。
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            暂无单独维护的技术栈字段；可在编辑页为项目补充标签，用于标识技术方向与检索。
          </p>
        )}
      </section>

      <section
        className="mt-12 scroll-mt-8"
        aria-labelledby="project-sources-heading"
        data-testid="project-sources-section"
      >
        <h2
          id="project-sources-heading"
          className="mb-4 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          项目信息源
        </h2>
        {sourceItems.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30">
            暂无信息源。在创建或编辑项目时补充仓库、官网、文档等链接后将在此展示。
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {sourceItems.map((s) => (
              <li key={s.id ? `${s.id}` : `${s.kind}-${s.url}`}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="project-source-link"
                  className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/80"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg dark:bg-zinc-800"
                      aria-hidden
                    >
                      {mapSourceEmoji(s.kind)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-50">{s.categoryLabel}</span>
                        {s.isPrimary ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                            主源
                          </span>
                        ) : null}
                      </div>
                      {s.hint ? (
                        <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{s.hint}</p>
                      ) : null}
                      <p className="mt-2 break-all text-xs text-blue-600 dark:text-blue-400">{s.url}</p>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12 scroll-mt-8" aria-labelledby="repo-data-heading" data-testid="github-snapshot-section">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="repo-data-heading" className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            仓库数据
          </h2>
          {githubRefreshSlot}
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
          {!data.githubSnapshot ? (
            <div>
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">暂无仓库快照数据</p>
              <p className="mt-2 text-sm text-zinc-500">
                {data.githubUrl?.trim()
                  ? showManageRepoActions
                    ? "点击「刷新仓库数据」从 GitHub / Gitee 拉取指标（写入快照历史，详情展示最新一条）。"
                    : "仓库指标由项目维护者在管理后台刷新后展示。"
                  : "请项目维护者在编辑页配置代码仓库地址后再刷新。"}
              </p>
            </div>
          ) : (
            <>
              <p className="font-mono text-sm text-zinc-800 dark:text-zinc-200" data-testid="github-snapshot-repo">
                {data.githubSnapshot.repoFullName}
              </p>
              <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="text-zinc-500">平台</span>
                <span className="mx-2 text-zinc-300 dark:text-zinc-600">·</span>
                <span data-testid="github-snapshot-platform">
                  {repoPlatformDisplayLabel(
                    data.githubSnapshot.repoPlatform ?? parseRepoUrl(data.githubUrl ?? "")?.platform,
                  )}
                </span>
              </p>
              {data.githubUrl ? (
                <a
                  href={data.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
                >
                  打开仓库
                </a>
              ) : null}
              <p className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <span
                  data-testid="github-snapshot-activity"
                  className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900 dark:bg-emerald-900/35 dark:text-emerald-200"
                >
                  {computeGithubActivity(data.githubSnapshot).label}
                </span>
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                指标来自已保存的仓库快照；手动刷新会新增一条记录并在此处显示最新数据。
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 text-sm sm:grid-cols-3">
                <div className="rounded-lg bg-zinc-50 px-3 py-3 dark:bg-zinc-800/50" data-testid="github-snapshot-stars">
                  <dt className="text-xs font-medium text-zinc-500">星标</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {data.githubSnapshot.stars}
                  </dd>
                </div>
                <div className="rounded-lg bg-zinc-50 px-3 py-3 dark:bg-zinc-800/50" data-testid="github-snapshot-forks">
                  <dt className="text-xs font-medium text-zinc-500">Forks</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {data.githubSnapshot.forks}
                  </dd>
                </div>
                <div className="rounded-lg bg-zinc-50 px-3 py-3 dark:bg-zinc-800/50" data-testid="github-snapshot-issues">
                  <dt className="text-xs font-medium text-zinc-500">待处理议题</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {data.githubSnapshot.openIssues}
                  </dd>
                </div>
                <div className="rounded-lg bg-zinc-50 px-3 py-3 dark:bg-zinc-800/50" data-testid="github-snapshot-watchers">
                  <dt className="text-xs font-medium text-zinc-500">Watchers</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {data.githubSnapshot.watchers}
                  </dd>
                </div>
                <div className="rounded-lg bg-zinc-50 px-3 py-3 dark:bg-zinc-800/50">
                  <dt className="text-xs font-medium text-zinc-500">贡献者（估算）</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {data.githubSnapshot.contributorsCount}
                  </dd>
                </div>
                <div className="rounded-lg bg-zinc-50 px-3 py-3 dark:bg-zinc-800/50">
                  <dt className="text-xs font-medium text-zinc-500">默认分支</dt>
                  <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-50">
                    {data.githubSnapshot.defaultBranch ?? "—"}
                  </dd>
                </div>
                <div className="col-span-2 rounded-lg bg-zinc-50 px-3 py-3 sm:col-span-3 dark:bg-zinc-800/50">
                  <dt className="text-xs font-medium text-zinc-500">最近提交</dt>
                  <dd className="mt-1 font-medium" data-testid="github-snapshot-last-commit">
                    {data.githubSnapshot.lastCommitAt
                      ? data.githubSnapshot.lastCommitAt.toLocaleString("zh-CN")
                      : "—"}
                  </dd>
                </div>
                <div className="col-span-2 rounded-lg bg-zinc-50 px-3 py-3 sm:col-span-3 dark:bg-zinc-800/50">
                  <dt className="text-xs font-medium text-zinc-500">最新版本</dt>
                  <dd className="mt-1 font-medium" data-testid="github-snapshot-release">
                    {data.githubSnapshot.latestReleaseTag
                      ? `${data.githubSnapshot.latestReleaseTag}${
                          data.githubSnapshot.latestReleaseAt
                            ? ` · ${data.githubSnapshot.latestReleaseAt.toLocaleString("zh-CN")}`
                            : ""
                        }`
                      : "—"}
                  </dd>
                </div>
                {data.githubSnapshot.fetchedAt ? (
                  <div className="col-span-2 text-xs text-zinc-500 sm:col-span-3">
                    <span className="font-medium text-zinc-600 dark:text-zinc-400">最近抓取</span>
                    <span className="ml-2" data-testid="github-snapshot-fetched-at">
                      {data.githubSnapshot.fetchedAt.toLocaleString("zh-CN")}
                    </span>
                  </div>
                ) : null}
              </dl>
            </>
          )}
        </div>
      </section>

      <section className="mt-14 scroll-mt-8" aria-labelledby="social-heading">
        <h2 id="social-heading" className="mb-4 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          社媒
        </h2>
        {socials.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30">
            暂无社媒信息
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {socials.map((s) => (
              <li key={`${s.platform}-${s.accountName}`}>
                {s.accountUrl ? (
                  <a
                    href={s.accountUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full flex-col rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                  >
                    <span className="text-xs font-medium text-zinc-500">{socialPlatformLabel(s.platform)}</span>
                    <span className="mt-0.5 truncate font-medium text-zinc-900 dark:text-zinc-100">{s.accountName}</span>
                  </a>
                ) : (
                  <span className="inline-flex flex-col rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/80">
                    <span className="text-xs font-medium text-zinc-500">{socialPlatformLabel(s.platform)}</span>
                    <span className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{s.accountName}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-14 scroll-mt-8 pb-8" aria-labelledby="about-heading">
        <h2 id="about-heading" className="mb-4 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          项目介绍
        </h2>
        {descriptionBody ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-800 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 md:p-8">
            <p className="whitespace-pre-wrap leading-relaxed">{descriptionBody}</p>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30">
            暂无项目介绍
          </p>
        )}
      </section>
    </>
  );
}
