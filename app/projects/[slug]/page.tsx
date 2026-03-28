import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ProjectDetailHero } from "@/components/project/project-detail-hero";
import { loadProjectPageViewCached, sortProjectSocials } from "@/lib/load-project-page-view";
import { prisma } from "@/lib/prisma";
import { canManageProject } from "@/lib/project-permissions";
import {
  buildProjectMetaDescription,
  buildProjectOpenGraph,
  buildProjectTwitter,
} from "@/lib/seo/project-meta";
import { SITE_URL } from "@/lib/seo/site";
import { socialPlatformLabel } from "@/lib/social-platform";
import { buildProjectUpdateStreamModel } from "@/lib/project-updates";
import { computeGithubActivity } from "@/lib/github-activity";
import { parseRepoUrl, repoPlatformDisplayLabel } from "@/lib/repo-platform";
import { getProjectSources, mapSourceEmoji } from "@/lib/project-sources";
import { ProjectJsonLd } from "@/components/project/project-json-ld";
import { ProjectShareActions } from "@/components/project/project-share-actions";
import {
  buildProjectShareClipboardText,
  buildProjectShareSocialLine,
  projectCanonicalUrl,
} from "@/lib/share/project-share";
import { RefreshGithubSnapshotForm } from "./refresh-github-form";
import { normalizeProjectSlugParam } from "@/lib/route-slug";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const slug = normalizeProjectSlugParam((await params).slug);
  const loaded = await loadProjectPageViewCached(slug);
  if (!loaded) {
    return { title: "项目" };
  }
  const { data } = loaded;
  return {
    title: data.name,
    description: buildProjectMetaDescription(data),
    alternates: {
      canonical: `${SITE_URL}/projects/${slug}`,
    },
    openGraph: buildProjectOpenGraph(data, slug),
    twitter: buildProjectTwitter(data),
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = normalizeProjectSlugParam((await params).slug);
  const loaded = await loadProjectPageViewCached(slug);
  if (!loaded) {
    notFound();
  }

  const { data, fromDb } = loaded;
  const session = await auth();
  let canManage = false;
  if (fromDb && process.env.DATABASE_URL?.trim()) {
    const owners = await prisma.project.findUnique({
      where: { slug },
      select: { createdById: true, claimedByUserId: true },
    });
    if (owners) {
      canManage = canManageProject(session?.user?.id, owners);
    }
  }

  const socials = sortProjectSocials(data.socials);

  const hasDescription = Boolean(data.description.trim());
  const descriptionBody = hasDescription ? data.description.trim() : null;

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

  const canonicalProjectUrl = projectCanonicalUrl(slug);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <ProjectJsonLd data={data} slug={slug} />
      <div className="mx-auto max-w-5xl px-6 py-10 md:py-12">
        <ProjectDetailHero
          slug={slug}
          name={data.name}
          tagline={data.tagline}
          createdAt={data.createdAt}
          canManage={canManage}
        />

        <ProjectShareActions
          canonicalUrl={canonicalProjectUrl}
          shareSocialLine={buildProjectShareSocialLine(data)}
          shareClipboardText={buildProjectShareClipboardText(data, slug)}
        />

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

        {/* 项目信息源 */}
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
                          <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                            {s.categoryLabel}
                          </span>
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

        {/* 仓库数据 */}
        <section
          className="mt-12 scroll-mt-8"
          aria-labelledby="repo-data-heading"
          data-testid="github-snapshot-section"
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="repo-data-heading" className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              仓库数据
            </h2>
            {fromDb && data.githubUrl?.trim() ? (
              <RefreshGithubSnapshotForm slug={slug} />
            ) : null}
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
            {!data.githubSnapshot ? (
              <div>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">暂无仓库快照数据</p>
                <p className="mt-2 text-sm text-zinc-500">
                  {data.githubUrl?.trim()
                    ? "点击「刷新仓库数据」从 GitHub / Gitee 拉取指标（写入快照历史，详情展示最新一条）。"
                    : "请先在编辑页配置代码仓库地址后再刷新。"}
                </p>
              </div>
            ) : (
              <>
                <p
                  className="font-mono text-sm text-zinc-800 dark:text-zinc-200"
                  data-testid="github-snapshot-repo"
                >
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

        {/* 项目动态 */}
        <section
          className="mt-14 scroll-mt-8"
          aria-labelledby="project-updates-heading"
          data-testid="project-updates-section"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2
              id="project-updates-heading"
              className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            >
              项目动态
            </h2>
            {fromDb ? (
              <Link
                href={`/dashboard/projects/${slug}/updates/new`}
                className="inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                发布动态
              </Link>
            ) : null}
          </div>
          <p className="mb-4 text-xs text-zinc-500">
            多源动态：手动发布、仓库、官方与 AI 等来源统一展示；当前按发布时间倒序（最新在前）。
          </p>
          <ul className="relative space-y-0 before:absolute before:left-[11px] before:top-3 before:h-[calc(100%-1.5rem)] before:w-px before:bg-zinc-200 dark:before:bg-zinc-700 sm:before:left-[13px]">
            {data.updates.length === 0 ? (
              <li className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30">
                暂无项目动态
              </li>
            ) : (
              data.updates.map((u, i) => {
                const displayAt = u.createdAt ?? u.occurredAt;
                const stream = buildProjectUpdateStreamModel({
                  sourceType: u.sourceType,
                  sourceLabel: u.sourceLabel,
                  isAiGenerated: u.isAiGenerated,
                });
                return (
                  <li
                    key={u.id ?? `update-${u.title}-${displayAt.toISOString()}-${i}`}
                    data-testid="project-update-item"
                    className="relative border-b border-zinc-100 py-6 pl-9 last:border-b-0 dark:border-zinc-800/80 sm:pl-10"
                  >
                    <span
                      className="absolute left-0 top-8 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-zinc-200 text-[10px] shadow-sm dark:border-zinc-900 dark:bg-zinc-700"
                      aria-hidden
                    />
                    <div className="flex flex-wrap items-center gap-2 gap-y-1">
                      <span
                        data-testid="project-update-source-badge"
                        className={stream.badgeClass}
                      >
                        {stream.primaryLabel}
                      </span>
                      {stream.aiAugment ? (
                        <span
                          data-testid="project-update-ai-badge"
                          className={stream.aiAugment.className}
                        >
                          {stream.aiAugment.label}
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
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {u.content}
                      </p>
                    ) : null}
                    {u.summary?.trim() ? (
                      <p
                        className={`mt-3 text-sm leading-relaxed ${
                          u.isAiGenerated
                            ? "border-l-2 border-amber-400/80 pl-3 text-zinc-700 dark:border-amber-500/60 dark:text-zinc-300"
                            : "text-zinc-600 dark:text-zinc-400"
                        }`}
                        data-testid={u.isAiGenerated ? "project-update-ai-summary" : undefined}
                      >
                        {u.isAiGenerated ? (
                          <span className="font-semibold text-amber-900 dark:text-amber-200">AI 摘要：</span>
                        ) : null}
                        {u.summary}
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
              })
            )}
          </ul>
        </section>

        {/* 社媒 */}
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

        {/* 项目介绍 */}
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
      </div>
    </div>
  );
}
