import type { ReactNode } from "react";
import { computeGithubActivity } from "@/lib/github-activity";
import type { ProjectPageView } from "@/lib/demo-project";
import { parseRepoUrl, repoPlatformDisplayLabel } from "@/lib/repo-platform";
import type { ProjectSourceDisplayItem } from "@/lib/project-sources";
import { mapSourceEmoji, mapSourceLabel } from "@/lib/project-sources";
import { socialPlatformLabel } from "@/lib/social-platform";

function externalPlatformHeading(platform: string): string {
  const p = platform.toLowerCase();
  const m: Record<string, string> = {
    website: "官网",
    github: "GitHub",
    docs: "文档",
    twitter: "X / Twitter",
    youtube: "YouTube",
    discord: "Discord / 社区",
    blog: "博客",
    telegram: "Telegram",
    producthunt: "Product Hunt",
  };
  return m[p] ?? platform;
}

const EXT_PLATFORM_ORDER = [
  "website",
  "github",
  "docs",
  "producthunt",
  "twitter",
  "youtube",
  "discord",
  "blog",
  "telegram",
];

function groupExternalLinks(links: NonNullable<ProjectPageView["externalLinks"]>) {
  const map = new Map<string, NonNullable<ProjectPageView["externalLinks"]>>();
  for (const L of links) {
    const k = L.platform.toLowerCase();
    if (!map.has(k)) {
      map.set(k, []);
    }
    map.get(k)!.push(L);
  }
  const out: { heading: string; items: NonNullable<ProjectPageView["externalLinks"]> }[] =
    [];
  for (const p of EXT_PLATFORM_ORDER) {
    const items = map.get(p);
    if (items?.length) {
      out.push({ heading: externalPlatformHeading(p), items });
    }
  }
  for (const [p, items] of map) {
    if (!EXT_PLATFORM_ORDER.includes(p) && items.length) {
      out.push({ heading: externalPlatformHeading(p), items });
    }
  }
  return out;
}

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
          className="muhub-prose-panel muhub-prose-panel--accent-secondary mt-8 md:px-8"
          data-testid="project-ai-summary"
          aria-labelledby="project-ai-card-heading"
        >
          <h2
            id="project-ai-card-heading"
            className="muhub-form-legend text-left text-[var(--muhub-secondary-700)] dark:text-[var(--muhub-secondary-300)]"
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
          className="muhub-prose-panel muhub-prose-panel--accent-warning mt-8 md:px-8"
          data-testid="project-ai-weekly-summary"
          aria-labelledby="project-ai-weekly-heading"
        >
          <h2
            id="project-ai-weekly-heading"
            className="muhub-form-legend text-left text-[var(--muhub-warning-700)] dark:text-[var(--muhub-warning-300)]"
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

      {data.fromDiscovery ? (
        <p
          className="mt-6 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400"
          data-testid="project-discovery-attribution"
        >
          本项目由站内自动发现候选经人工审核整理后入库；外链与类型信息可能随运营补全更新。
        </p>
      ) : null}

      {(data.tags?.length ||
        data.primaryCategory?.trim() ||
        (data.categories && data.categories.length > 0) ||
        data.isAiRelated ||
        data.isChineseTool) ? (
        <section
          className="muhub-card mt-8 px-5 py-5 sm:px-6"
          data-testid="project-tags"
          aria-labelledby="project-type-tags-heading"
        >
          <h2
            id="project-type-tags-heading"
            className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            类型与标签
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {data.primaryCategory?.trim() ? (
              <span className="muhub-badge muhub-badge--category">
                主类型 · {data.primaryCategory.trim()}
              </span>
            ) : null}
            {(data.categories ?? [])
              .filter((c) => c !== data.primaryCategory)
              .map((c) => (
                <span key={c} className="muhub-badge muhub-badge--neutral text-xs">
                  {c}
                </span>
              ))}
            {(data.tags ?? []).map((t) => (
              <span key={t} className="muhub-badge muhub-badge--neutral text-xs font-medium">
                #{t}
              </span>
            ))}
            {data.isAiRelated ? (
              <span className="muhub-badge muhub-badge--sky text-xs">AI 相关</span>
            ) : null}
            {data.isChineseTool ? (
              <span className="muhub-badge muhub-badge--amber text-xs">中文工具</span>
            ) : null}
          </div>
        </section>
      ) : null}

      {data.externalLinks && data.externalLinks.length > 0 ? (
        <section
          className="mt-10 scroll-mt-8"
          aria-labelledby="project-external-links-heading"
          data-testid="project-external-links-section"
        >
          <h2 id="project-external-links-heading" className="muhub-page-section-title">
            外部链接
          </h2>
          <div className="space-y-8">
            {groupExternalLinks(data.externalLinks).map((group) => (
              <div key={group.heading}>
                <h3 className="muhub-form-legend mb-3 text-left">{group.heading}</h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {group.items.map((link, i) => (
                    <li key={`${link.platform}-${link.url}-${i}`}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="muhub-card muhub-card--interactive flex flex-col p-3.5 text-sm"
                      >
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {link.label?.trim() || externalPlatformHeading(link.platform)}
                          {link.isPrimary ? (
                            <span className="muhub-badge muhub-badge--amber ml-2 align-middle text-[10px]">
                              主链
                            </span>
                          ) : null}
                        </span>
                        {link.source === "discovery_enrichment" ? (
                          <span className="mt-0.5 text-[10px] text-zinc-500">
                            来自 Discovery 补全
                          </span>
                        ) : null}
                        <span className="mt-1 break-all text-xs text-blue-600 dark:text-blue-400">
                          {link.url}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {sourceItems.length > 0 ? (
        <section
          className="mt-12 scroll-mt-8"
          aria-labelledby="project-ops-info-heading"
          data-testid="project-ops-info-section"
        >
          <h2 id="project-ops-info-heading" className="muhub-page-section-title">
            运营信息
          </h2>
          <div className="muhub-card overflow-hidden">
            <div className="space-y-2.5 px-6 py-5 text-sm">
              {sourceItems.map((s) => (
                <div
                  key={s.id ? s.id : `${s.kind}-${s.url}`}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-zinc-100 pb-2 last:border-b-0 last:pb-0 dark:border-zinc-800/80"
                >
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {mapSourceLabel(s.kind)}
                  </span>
                  <span className="text-zinc-400">·</span>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                  >
                    {s.url}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section
        className="mt-12 scroll-mt-8"
        aria-labelledby="project-sources-heading"
        data-testid="project-sources-section"
      >
        <h2 id="project-sources-heading" className="muhub-page-section-title">
          项目信息源
        </h2>
        {sourceItems.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30">
            暂无信息源。在创建或编辑项目时补充仓库、官网、文档等链接后将在此展示。
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {sourceItems.map((s) => (
              <li key={s.id ? `${s.id}` : `${s.kind}-${s.url}`}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="project-source-link"
                  className="muhub-card muhub-card--interactive flex h-full flex-col p-4"
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
                          <span className="muhub-badge muhub-badge--amber text-[10px] uppercase tracking-wide">
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
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="repo-data-heading" className="muhub-page-section-title mb-0">
              代码仓库数据
            </h2>
            <span
              className="inline-flex h-5 min-w-[1.25rem] cursor-help items-center justify-center rounded-full border border-zinc-300 px-1 text-[11px] font-semibold leading-none text-zinc-500 dark:border-zinc-600 dark:text-zinc-400"
              title="代码仓库数据用于展示项目公开代码仓库的基础活跃情况，例如最近更新、公开信息完整度等。这些数据只反映公开仓库侧信号，不等同于项目整体运营情况。"
              aria-label="代码仓库数据说明"
            >
              ?
            </span>
          </div>
          {githubRefreshSlot}
        </div>
        <div className="muhub-card p-6 md:p-8">
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
                  className="muhub-badge muhub-badge--success px-3 py-1 text-xs font-semibold"
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

      <section className="mt-12 scroll-mt-8" aria-labelledby="ops-data-heading" data-testid="project-ops-data-section">
        <h2 id="ops-data-heading" className="muhub-page-section-title">
          运营数据
        </h2>
        <div className="muhub-card p-6 text-sm text-zinc-500 dark:text-zinc-400 md:p-8">
          暂无运营数据
        </div>
      </section>

      <section className="mt-14 scroll-mt-8" aria-labelledby="social-heading">
        <h2 id="social-heading" className="muhub-page-section-title">
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
        <h2 id="about-heading" className="muhub-page-section-title">
          项目介绍
        </h2>
        {descriptionBody ? (
          <div className="muhub-card p-6 text-zinc-800 dark:text-zinc-200 md:p-8">
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
