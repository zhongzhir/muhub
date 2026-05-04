import type { ReactNode } from "react";
import { computeGithubActivity } from "@/lib/github-activity";
import type { ProjectPageView } from "@/lib/demo-project";
import { parseRepoUrl, repoPlatformDisplayLabel } from "@/lib/repo-platform";
import type { ProjectSourceDisplayItem } from "@/lib/project-sources";
import { mapSourceEmoji } from "@/lib/project-sources";
import { getProjectCategoryLabel } from "@/lib/projects/project-categories";
import { socialPlatformLabel } from "@/lib/social-platform";

function externalPlatformHeading(platform: string): string {
  const p = platform.toLowerCase();
  const m: Record<string, string> = {
    website: "官网",
    github: "GitHub",
    gitcc: "GitCC",
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
  "gitcc",
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
  for (const link of links) {
    const key = link.platform.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(link);
  }
  const out: { heading: string; items: NonNullable<ProjectPageView["externalLinks"]> }[] = [];
  for (const p of EXT_PLATFORM_ORDER) {
    const items = map.get(p);
    if (items?.length) out.push({ heading: externalPlatformHeading(p), items });
  }
  for (const [p, items] of map) {
    if (!EXT_PLATFORM_ORDER.includes(p) && items.length) {
      out.push({ heading: externalPlatformHeading(p), items });
    }
  }
  return out;
}

function normalizedUrlKey(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url.trim());
    u.hash = "";
    let out = u.toString();
    if (out.endsWith("/") && u.pathname !== "/") out = out.slice(0, -1);
    return out.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function isPrimaryCodeOrWebsiteSource(item: ProjectSourceDisplayItem): boolean {
  if (item.kind === "GITHUB" || item.kind === "WEBSITE") return true;
  return item.kind === "OTHER" && item.categoryLabel.toLowerCase() === "gitcc";
}

function isWeChatArticleUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "mp.weixin.qq.com" || host.endsWith(".mp.weixin.qq.com");
  } catch {
    return false;
  }
}

function isWeChatArticle(item: ProjectSourceDisplayItem): boolean {
  return item.kind === "WECHAT_ARTICLE" || isWeChatArticleUrl(item.url);
}

function sourceTypeLabel(item: ProjectSourceDisplayItem): string {
  if (isWeChatArticle(item)) return "公众号文章";
  return item.categoryLabel;
}

function shortSummary(value: string | null | undefined): string | null {
  const text = value?.trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.length > 140 ? `${text.slice(0, 139)}…` : text;
}

type Props = {
  data: ProjectPageView;
  socials: ProjectPageView["socials"];
  sourceItems: ProjectSourceDisplayItem[];
  descriptionBody: string | null;
  githubRefreshSlot?: ReactNode;
};

export function ProjectDetailInfoSections({
  data,
  socials,
  sourceItems,
  descriptionBody,
  githubRefreshSlot,
}: Props) {
  const topLinkKeys = new Set(
    [data.websiteUrl, data.githubUrl, ...sourceItems.filter(isPrimaryCodeOrWebsiteSource).map((s) => s.url)]
      .map(normalizedUrlKey)
      .filter((x): x is string => Boolean(x)),
  );
  const visibleExternalLinks = (data.externalLinks ?? []).filter((link) => {
    const platform = link.platform.toLowerCase();
    if (platform === "website" || platform === "github" || platform === "gitcc") return false;
    const key = normalizedUrlKey(link.url);
    return !key || !topLinkKeys.has(key);
  });
  const visibleSourceItems = sourceItems.filter((item) => {
    if (item.kind === "WECHAT_ARTICLE") return true;
    const key = normalizedUrlKey(item.url);
    return !key || !topLinkKeys.has(key);
  });

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

      {(data.tags?.length ||
        data.primaryCategory?.trim() ||
        (data.categories && data.categories.length > 0) ||
        data.isAiRelated ||
        data.isChineseTool) ? (
        <section className="muhub-card mt-8 px-5 py-5 sm:px-6" data-testid="project-tags" aria-labelledby="project-type-tags-heading">
          <h2 id="project-type-tags-heading" className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            类型与标签
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {data.primaryCategory?.trim() ? (
              <span className="muhub-badge muhub-badge--category">
                分类 · {getProjectCategoryLabel(data.primaryCategory.trim(), data.primaryCategory.trim())}
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
            {data.isAiRelated ? <span className="muhub-badge muhub-badge--sky text-xs">AI 相关</span> : null}
            {data.isChineseTool ? <span className="muhub-badge muhub-badge--amber text-xs">中文工具</span> : null}
          </div>
        </section>
      ) : null}

      {visibleExternalLinks.length > 0 ? (
        <section className="mt-10 scroll-mt-8" aria-labelledby="project-external-links-heading" data-testid="project-external-links-section">
          <h2 id="project-external-links-heading" className="muhub-page-section-title">
            外部链接
          </h2>
          <div className="space-y-8">
            {groupExternalLinks(visibleExternalLinks).map((group) => (
              <div key={group.heading}>
                <h3 className="muhub-form-legend mb-3 text-left">{group.heading}</h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {group.items.map((link, i) => (
                    <li key={`${link.platform}-${link.url}-${i}`}>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="muhub-card muhub-card--interactive flex flex-col p-3.5 text-sm">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {link.label?.trim() || externalPlatformHeading(link.platform)}
                          {link.isPrimary ? <span className="muhub-badge muhub-badge--amber ml-2 align-middle text-[10px]">主链</span> : null}
                        </span>
                        <span className="mt-1 break-all text-xs text-blue-600 dark:text-blue-400">{link.url}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {(() => {
        // 公众号来源前台不展示卡片（仅作为内部信息源用于内容整理）
        const publicSources = visibleSourceItems.filter((item) => !isWeChatArticle(item));
        const hasAnyConfigured = visibleSourceItems.length > 0;
        if (!hasAnyConfigured) return null;
        return (
          <section
            className="mt-12 scroll-mt-8"
            aria-labelledby="project-sources-heading"
            data-testid="project-sources-section"
          >
            <h2 id="project-sources-heading" className="muhub-page-section-title">
              项目信息源
            </h2>
            {publicSources.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2">
                {publicSources.map((source) => {
                  const sourceSummary = shortSummary(source.summary);
                  const titleText = (source.title || source.hint || "").trim();
                  return (
                    <li key={source.id ? `${source.id}` : `${source.kind}-${source.url}`}>
                      <div
                        data-testid="project-source-link"
                        className="muhub-card flex h-full flex-col p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg dark:bg-zinc-800"
                            aria-hidden
                          >
                            {mapSourceEmoji(source.kind)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                                {sourceTypeLabel(source)}
                              </span>
                              {source.isPrimary ? (
                                <span className="muhub-badge muhub-badge--amber text-[10px] uppercase tracking-wide">
                                  主源
                                </span>
                              ) : null}
                            </div>
                            {titleText ? (
                              <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                                {titleText}
                              </p>
                            ) : null}
                            {sourceSummary ? (
                              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{sourceSummary}</p>
                            ) : null}
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex break-all text-xs text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                            >
                              查看来源
                            </a>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              本项目页基于网络公开信息整理，如有侵权，请联系我们。
            </p>
          </section>
        );
      })()}

      {data.githubSnapshot || data.githubUrl?.trim() ? (
        <section className="mt-12 scroll-mt-8" aria-labelledby="repo-data-heading" data-testid="github-snapshot-section">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="repo-data-heading" className="muhub-page-section-title mb-0">
              代码仓库数据
            </h2>
            {githubRefreshSlot}
          </div>
          <div className="muhub-card p-6 md:p-8">
            {!data.githubSnapshot ? (
              <div>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">暂无仓库快照数据</p>
                <p className="mt-2 text-sm text-zinc-500">
                  {data.githubUrl?.trim()
                    ? "点击「刷新仓库数据」从 GitHub / Gitee 拉取指标。"
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
                  <a href={data.githubUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400">
                    打开仓库
                  </a>
                ) : null}
                <p className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <span data-testid="github-snapshot-activity" className="muhub-badge muhub-badge--success px-3 py-1 text-xs font-semibold">
                    {computeGithubActivity(data.githubSnapshot).label}
                  </span>
                </p>
                <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 text-sm sm:grid-cols-3">
                  <div className="rounded-lg bg-zinc-50 px-3 py-3 dark:bg-zinc-800/50" data-testid="github-snapshot-stars">
                    <dt className="text-xs font-medium text-zinc-500">星标</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{data.githubSnapshot.stars}</dd>
                  </div>
                  <div className="rounded-lg bg-zinc-50 px-3 py-3 dark:bg-zinc-800/50" data-testid="github-snapshot-forks">
                    <dt className="text-xs font-medium text-zinc-500">Forks</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{data.githubSnapshot.forks}</dd>
                  </div>
                  <div className="rounded-lg bg-zinc-50 px-3 py-3 dark:bg-zinc-800/50" data-testid="github-snapshot-issues">
                    <dt className="text-xs font-medium text-zinc-500">待处理议题</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{data.githubSnapshot.openIssues}</dd>
                  </div>
                  <div className="rounded-lg bg-zinc-50 px-3 py-3 dark:bg-zinc-800/50" data-testid="github-snapshot-watchers">
                    <dt className="text-xs font-medium text-zinc-500">Watchers</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{data.githubSnapshot.watchers}</dd>
                  </div>
                  <div className="rounded-lg bg-zinc-50 px-3 py-3 dark:bg-zinc-800/50">
                    <dt className="text-xs font-medium text-zinc-500">贡献者</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{data.githubSnapshot.contributorsCount}</dd>
                  </div>
                  <div className="col-span-2 rounded-lg bg-zinc-50 px-3 py-3 sm:col-span-3 dark:bg-zinc-800/50">
                    <dt className="text-xs font-medium text-zinc-500">最近提交</dt>
                    <dd className="mt-1 font-medium" data-testid="github-snapshot-last-commit">
                      {data.githubSnapshot.lastCommitAt ? data.githubSnapshot.lastCommitAt.toLocaleString("zh-CN") : "暂无"}
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
                </dl>
              </>
            )}
          </div>
        </section>
      ) : null}

      {socials.length > 0 ? (
        <section className="mt-14 scroll-mt-8" aria-labelledby="social-heading">
          <h2 id="social-heading" className="muhub-page-section-title">
            社媒
          </h2>
          <ul className="flex flex-wrap gap-2">
            {socials.map((social) => (
              <li key={`${social.platform}-${social.accountName}`}>
                {social.accountUrl ? (
                  <a href={social.accountUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full flex-col rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800">
                    <span className="text-xs font-medium text-zinc-500">{socialPlatformLabel(social.platform)}</span>
                    <span className="mt-0.5 truncate font-medium text-zinc-900 dark:text-zinc-100">{social.accountName}</span>
                  </a>
                ) : (
                  <span className="inline-flex flex-col rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/80">
                    <span className="text-xs font-medium text-zinc-500">{socialPlatformLabel(social.platform)}</span>
                    <span className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{social.accountName}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {descriptionBody ? (
        <section className="mt-14 scroll-mt-8 pb-8" aria-labelledby="about-heading">
          <h2 id="about-heading" className="muhub-page-section-title">
            项目介绍
          </h2>
          <div className="muhub-card p-6 text-zinc-800 dark:text-zinc-200 md:p-8">
            <p className="whitespace-pre-wrap leading-relaxed">{descriptionBody}</p>
          </div>
        </section>
      ) : null}
    </>
  );
}
