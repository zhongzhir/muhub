import Link from "next/link";
import { notFound } from "next/navigation";
import { loadProjectPageView, sortProjectSocials } from "@/lib/load-project-page-view";
import { formatListDate } from "@/lib/format-date";
import { ProjectBadgeStrip } from "@/components/project/project-badge-strip";
import { buildProjectBadgeGroups } from "@/lib/project-badges";
import { socialPlatformLabel } from "@/lib/social-platform";
import { computeGithubActivity } from "@/lib/github-activity";
import { codeHostLinkLabel, parseRepoUrl, repoPlatformDisplayLabel } from "@/lib/repo-platform";
import {
  projectShareInitial,
  takeRecentUpdatesForShare,
  buildShareHighlightParagraphs,
  buildShareProgressModel,
} from "@/lib/share-project-view";
import { getProjectSources, mapSourceEmoji } from "@/lib/project-sources";
import { ShareHighlightSection } from "@/components/project/share-highlight-section";
import { ShareProgressSection } from "@/components/project/share-progress-section";
import { buildProjectShareSocialLine, projectCanonicalUrl } from "@/lib/share/project-share";
import { buildWeiboShareUrl } from "@/lib/share/weibo";
import { CopyLinkButton } from "./copy-link-button";
import { normalizeProjectSlugParam } from "@/lib/route-slug";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ShareProjectPage({ params }: PageProps) {
  const slug = normalizeProjectSlugParam((await params).slug);
  const loaded = await loadProjectPageView(slug);
  if (!loaded) {
    notFound();
  }

  const { data, fromDb } = loaded;
  const socials = sortProjectSocials(data.socials);
  const recentUpdates = takeRecentUpdatesForShare(data.updates);
  const highlight = buildShareHighlightParagraphs(data);
  const progressModel = buildShareProgressModel(data, recentUpdates);

  const { source: shareSourceBadges, lifecycle: shareLifecycleBadges } = buildProjectBadgeGroups({
    slug,
    fromDb,
    sourceType: data.sourceType,
    isFeatured: data.isFeatured,
    claimStatus: data.claimStatus,
    status: data.status,
  });
  const snap = data.githubSnapshot;

  const sourceItems = getProjectSources({
    legacyGithubUrl: data.githubUrl,
    legacyWebsiteUrl: data.websiteUrl,
    rows: (data.sources ?? []).map((s) => ({
      id: s.id,
      kind: s.kind,
      url: s.url,
      label: s.label ?? null,
      isPrimary: Boolean(s.isPrimary),
    })),
  });

  const initial = projectShareInitial(data.name);
  const canonicalProjectUrl = projectCanonicalUrl(slug);
  const weiboShareHref = buildWeiboShareUrl(canonicalProjectUrl, buildProjectShareSocialLine(data));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-zinc-100 to-zinc-200 px-4 py-8 text-zinc-900 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900 dark:text-zinc-50 sm:py-12">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
          <span className="font-medium uppercase tracking-widest text-zinc-500">项目名片 · 分享</span>
          <div className="flex flex-wrap gap-4">
            <Link href={`/projects/${slug}`} className="font-medium underline-offset-4 hover:underline">
              完整主页
            </Link>
            <Link href="/" className="underline-offset-4 hover:underline">
              木哈布
            </Link>
          </div>
        </div>

        <article className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-xl ring-1 ring-zinc-200/50 dark:border-zinc-700/90 dark:bg-zinc-900 dark:ring-zinc-800/80">
          {/* 1. Hero */}
          <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 px-6 pb-8 pt-8 text-white">
            <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
              <div className="relative shrink-0">
                {data.logoUrl?.trim() ? (
                  <div className="flex h-24 w-24 overflow-hidden rounded-2xl border-2 border-white/20 bg-white/10 shadow-lg ring-2 ring-black/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={data.logoUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-white/25 bg-white/15 text-3xl font-bold tracking-tight shadow-lg ring-2 ring-black/20"
                    aria-hidden
                  >
                    {initial}
                  </div>
                )}
              </div>
              <div className="mt-6 min-w-0 flex-1 sm:ml-5 sm:mt-0">
                <h1
                  className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
                  data-testid="share-project-name"
                >
                  {data.name}
                </h1>
                {data.tagline ? (
                  <p
                    className="mt-3 text-base leading-snug text-zinc-200 sm:text-lg"
                    data-testid="share-project-tagline"
                  >
                    {data.tagline}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-zinc-400" data-testid="share-project-tagline">
                    暂无简介
                  </p>
                )}
                <div className="mt-4 flex justify-center sm:justify-start">
                  <ProjectBadgeStrip
                    source={shareSourceBadges}
                    lifecycle={shareLifecycleBadges}
                    theme="dark"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {/* 2. 项目亮点 */}
            <ShareHighlightSection
              paragraphs={highlight.paragraphs}
              source={highlight.source}
              tags={data.tags && data.tags.length > 0 ? data.tags : undefined}
            />

            {/* 3. 当前进展 */}
            <ShareProgressSection model={progressModel} githubSnapshot={snap} />

            {/* 4. 信息源 / 链接 */}
            <section
              className="px-6 py-6"
              aria-labelledby="share-sources-heading"
              data-testid="share-project-sources"
            >
              <h2
                id="share-sources-heading"
                className="text-xs font-semibold uppercase tracking-widest text-zinc-500"
              >
                项目信息源
              </h2>
              <p className="mt-1 text-[11px] text-zinc-400">仓库 · 官网 · 文档 · 博客与社媒，一键跳转</p>
              {sourceItems.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-400">暂无公开链接，可在完整主页查看是否已配置。</p>
              ) : (
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {sourceItems.map((s) => (
                    <li key={s.id ? `${s.id}` : `${s.kind}-${s.url}`}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="share-source-link"
                        className="flex items-center gap-3 rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-3 py-3 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-white dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-100 dark:hover:border-zinc-500"
                      >
                        <span className="text-lg" aria-hidden>
                          {mapSourceEmoji(s.kind)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{s.categoryLabel}</span>
                          {s.hint ? (
                            <span className="mt-0.5 block truncate text-[11px] font-normal text-zinc-500">
                              {s.hint}
                            </span>
                          ) : null}
                        </span>
                        {s.isPrimary ? (
                          <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                            主
                          </span>
                        ) : null}
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-6">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">社媒</h3>
                {socials.length === 0 ? (
                  <p className="mt-2 text-sm text-zinc-400">暂无社媒</p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {socials.map((s) => (
                      <li key={`${s.platform}-${s.accountName}`}>
                        {s.accountUrl?.trim() ? (
                          <a
                            href={s.accountUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-blue-400 dark:hover:bg-zinc-700"
                          >
                            {socialPlatformLabel(s.platform)}
                          </a>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {socialPlatformLabel(s.platform)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="mt-4 text-xs text-zinc-500">创建于 {formatListDate(data.createdAt)}</p>
            </section>

            {/* 5. 仓库数据（后置、辅助参考） */}
            {snap ? (
              <section
                className="px-6 py-6"
                aria-label="仓库指标参考"
                data-testid="share-github-stats"
              >
                <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  仓库指标参考
                </h2>
                <p className="mt-1 text-[11px] text-zinc-400">
                  以下为快照数据，仅供侧面了解活跃度，不影响上方价值叙述。
                </p>
                <p className="mt-3 text-xs font-medium text-zinc-500" data-testid="share-repo-platform-heading">
                  {repoPlatformDisplayLabel(
                    snap.repoPlatform ?? parseRepoUrl(data.githubUrl ?? "")?.platform,
                  )}
                </p>
                <p className="mt-1 font-mono text-xs text-zinc-500">{snap.repoFullName}</p>
                <dl className="mt-4 grid grid-cols-3 gap-3 text-center sm:text-left">
                  <div className="rounded-lg bg-zinc-50 px-2 py-2 dark:bg-zinc-800/80">
                    <dt className="text-[11px] font-medium text-zinc-500">星标</dt>
                    <dd className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{snap.stars}</dd>
                  </div>
                  <div className="rounded-lg bg-zinc-50 px-2 py-2 dark:bg-zinc-800/80">
                    <dt className="text-[11px] font-medium uppercase text-zinc-500">Forks</dt>
                    <dd className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{snap.forks}</dd>
                  </div>
                  <div className="rounded-lg bg-zinc-50 px-2 py-2 dark:bg-zinc-800/80">
                    <dt className="text-[11px] font-medium text-zinc-500">待处理议题</dt>
                    <dd className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{snap.openIssues}</dd>
                  </div>
                </dl>
                <div
                  className="mt-4 space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800"
                  data-testid="share-github-activity-block"
                >
                  {snap.lastCommitAt ? (
                    <p className="text-sm" data-testid="share-github-last-commit">
                      <span className="text-zinc-500">最近提交 </span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {snap.lastCommitAt.toLocaleString("zh-CN")}
                      </span>
                    </p>
                  ) : null}
                  <p className="text-sm" data-testid="share-github-activity">
                    <span className="text-zinc-500">活跃度 </span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {computeGithubActivity(snap).label}
                    </span>
                  </p>
                  {data.githubUrl ? (
                    <p>
                      <a
                        href={data.githubUrl}
                        className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                      >
                        {codeHostLinkLabel(data.githubUrl)}
                      </a>
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>

          {/* 6. 复制分享链接 CTA */}
          <footer className="border-t border-zinc-100 bg-zinc-50/90 px-6 py-8 dark:border-zinc-800 dark:bg-zinc-900/90">
            <p className="mb-4 text-center text-sm font-medium text-zinc-600 dark:text-zinc-400">
              复制链接，将本名片发给投资人、合作方或客户
            </p>
            <div className="mx-auto flex w-full max-w-md min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
              <CopyLinkButton />
              <a
                href={weiboShareHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 py-3.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 sm:w-auto sm:min-h-0 sm:min-w-[200px] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                分享到微博
              </a>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}
