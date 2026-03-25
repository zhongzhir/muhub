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
} from "@/lib/share-project-view";
import { CopyLinkButton } from "./copy-link-button";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ShareProjectPage({ params }: PageProps) {
  const { slug } = await params;
  const loaded = await loadProjectPageView(slug);
  if (!loaded) {
    notFound();
  }

  const { data, fromDb } = loaded;
  const socials = sortProjectSocials(data.socials);
  const descriptionText = data.description.trim()
    ? data.description
    : "暂无项目介绍";

  const recentUpdates = takeRecentUpdatesForShare(data.updates);
  const { source: shareSourceBadges, lifecycle: shareLifecycleBadges } = buildProjectBadgeGroups({
    slug,
    fromDb,
    sourceType: data.sourceType,
    isFeatured: data.isFeatured,
    claimStatus: data.claimStatus,
    status: data.status,
  });
  const snap = data.githubSnapshot;

  const initial = projectShareInitial(data.name);

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
              MUHUB
            </Link>
          </div>
        </div>

        <article className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-xl ring-1 ring-zinc-200/50 dark:border-zinc-700/90 dark:bg-zinc-900 dark:ring-zinc-800/80">
          {/* 顶部品牌区 */}
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

          <div className="space-y-0 divide-y divide-zinc-100 px-6 dark:divide-zinc-800">
            {/* GitHub 精简指标 */}
            {snap ? (
              <section className="py-5" aria-label="仓库指标" data-testid="share-github-stats">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <span data-testid="share-repo-platform-heading">
                    {repoPlatformDisplayLabel(
                      snap.repoPlatform ?? parseRepoUrl(data.githubUrl ?? "")?.platform,
                    )}
                  </span>
                </h2>
                <p className="mb-3 font-mono text-xs text-zinc-500">{snap.repoFullName}</p>
                <dl className="grid grid-cols-3 gap-3 text-center sm:text-left">
                  <div className="rounded-lg bg-zinc-50 px-2 py-2 dark:bg-zinc-800/80">
                    <dt className="text-[11px] font-medium uppercase text-zinc-500">Stars</dt>
                    <dd className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{snap.stars}</dd>
                  </div>
                  <div className="rounded-lg bg-zinc-50 px-2 py-2 dark:bg-zinc-800/80">
                    <dt className="text-[11px] font-medium uppercase text-zinc-500">Forks</dt>
                    <dd className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{snap.forks}</dd>
                  </div>
                  <div className="rounded-lg bg-zinc-50 px-2 py-2 dark:bg-zinc-800/80">
                    <dt className="text-[11px] font-medium uppercase text-zinc-500">Issues</dt>
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
                </div>
              </section>
            ) : null}

            {/* 链接与时间 */}
            <section className="py-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">链接</h2>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
                <li>
                  {data.githubUrl ? (
                    <a
                      href={data.githubUrl}
                      className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                    >
                      {codeHostLinkLabel(data.githubUrl)}
                    </a>
                  ) : (
                    <span className="text-zinc-400">代码仓库 —</span>
                  )}
                </li>
                <li>
                  {data.websiteUrl ? (
                    <a
                      href={data.websiteUrl}
                      className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                    >
                      官网
                    </a>
                  ) : (
                    <span className="text-zinc-400">官网 —</span>
                  )}
                </li>
              </ul>
              <p className="mt-3 text-xs text-zinc-500">创建于 {formatListDate(data.createdAt)}</p>
            </section>

            {/* 社媒概览 */}
            <section className="py-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                社媒概览
              </h2>
              {socials.length === 0 ? (
                <p className="text-sm text-zinc-400">暂无社媒</p>
              ) : (
                <>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {socials.length} 个账号
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {socials.slice(0, 6).map((s) => (
                      <li
                        key={`${s.platform}-${s.accountName}`}
                        className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {socialPlatformLabel(s.platform)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {/* 最近动态 */}
            <section className="py-5" data-testid="share-recent-updates">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                最近动态
              </h2>
              {recentUpdates.length === 0 ? (
                <p className="text-sm text-zinc-400">暂无动态</p>
              ) : (
                <ul className="space-y-3">
                  {recentUpdates.map((u, i) => {
                    const t = u.createdAt ?? u.occurredAt;
                    return (
                      <li
                        key={u.id ?? `${u.title}-${t.toISOString()}-${i}`}
                        data-testid="share-recent-update-item"
                        className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/40"
                      >
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{u.title}</p>
                        <time className="mt-0.5 block text-xs text-zinc-500" dateTime={t.toISOString()}>
                          {t.toLocaleString("zh-CN")}
                        </time>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* 项目介绍（便于截图时仍有上下文，略压缩） */}
            <section className="py-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                关于项目
              </h2>
              <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {descriptionText}
              </p>
            </section>
          </div>

          <footer className="border-t border-zinc-100 bg-zinc-50/80 px-6 py-6 dark:border-zinc-800 dark:bg-zinc-900/80">
            <p className="mb-4 text-center text-xs text-zinc-500">复制下方链接，便于聊天或邮件中分享本名片</p>
            <div className="flex justify-center">
              <CopyLinkButton />
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}
