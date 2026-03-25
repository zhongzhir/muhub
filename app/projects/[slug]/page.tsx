import Link from "next/link";
import { notFound } from "next/navigation";
import { loadProjectPageView, sortProjectSocials } from "@/lib/load-project-page-view";
import { projectStatusLabel } from "@/lib/project-status";
import { socialPlatformLabel } from "@/lib/social-platform";
import { updateSourceTypeLabel } from "@/lib/update-source";
import { isRecommendedProject } from "@/lib/recommended-projects";
import { RefreshGithubSnapshotForm } from "./refresh-github-form";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
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

  const showClaimCta = Boolean(
    fromDb && data.claimStatus === "UNCLAIMED" && data.githubUrl?.trim(),
  );
  const showClaimed = Boolean(fromDb && data.claimStatus === "CLAIMED");
  const showRecommendedClaim = Boolean(!fromDb && isRecommendedProject(slug));

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="mb-6 flex flex-wrap gap-4 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
          <Link href={`/projects/${slug}/share`} className="underline-offset-4 hover:underline">
            分享项目
          </Link>
          {fromDb ? (
            <>
              <Link
                href={`/dashboard/projects/${slug}/edit`}
                className="underline-offset-4 hover:underline"
              >
                编辑项目
              </Link>
              <Link
                href={`/dashboard/projects/${slug}/updates/new`}
                className="underline-offset-4 hover:underline"
              >
                发布动态
              </Link>
            </>
          ) : null}
        </p>

        {showRecommendedClaim ? (
          <div
            data-testid="recommended-project-hint"
            className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/30"
          >
            <p className="font-medium text-amber-950 dark:text-amber-100">这是推荐项目</p>
            <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-200/90">
              认领后可编辑管理
            </p>
            <Link
              href={`/dashboard/projects/new?from=recommended&slug=${encodeURIComponent(slug)}`}
              data-testid="claim-recommended-button"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              认领项目
            </Link>
          </div>
        ) : null}

        <header className="mb-10 border-b border-zinc-200 pb-8 dark:border-zinc-800">
          <p className="text-sm font-medium text-zinc-500">项目主页</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-semibold tracking-tight">{data.name}</h1>
              {showClaimed ? (
                <p
                  data-testid="project-claimed-label"
                  className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400"
                >
                  已认领
                </p>
              ) : null}
            </div>
            {showClaimCta ? (
              <Link
                href={`/projects/${slug}/claim`}
                data-testid="claim-project-button"
                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                认领该项目
              </Link>
            ) : null}
          </div>
          {data.tagline ? (
            <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">{data.tagline}</p>
          ) : null}
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <div>
              <dt className="inline text-zinc-500">slug：</dt>
              <dd className="inline font-mono text-zinc-800 dark:text-zinc-200">{data.slug}</dd>
            </div>
            <div>
              <dt className="inline text-zinc-500">状态：</dt>
              <dd className="inline">{projectStatusLabel(data.status)}</dd>
            </div>
            <div>
              <dt className="inline text-zinc-500">创建时间：</dt>
              <dd className="inline">{data.createdAt.toLocaleString("zh-CN")}</dd>
            </div>
          </dl>
        </header>

        <section className="mb-10" aria-labelledby="links-heading">
          <h2 id="links-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            链接
          </h2>
          <ul className="flex flex-wrap gap-4 text-sm">
            <li>
              {data.githubUrl ? (
                <a
                  href={data.githubUrl}
                  className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                >
                  GitHub
                </a>
              ) : (
                <span className="text-zinc-400">未填写 GitHub</span>
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
                <span className="text-zinc-400">未填写官网</span>
              )}
            </li>
          </ul>
        </section>

        <section
          className="mb-10"
          aria-labelledby="github-heading"
          data-testid="github-snapshot-section"
        >
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2
              id="github-heading"
              className="text-sm font-semibold uppercase tracking-wide text-zinc-500"
            >
              GitHub 数据
            </h2>
            {fromDb && data.githubUrl?.trim() ? (
              <RefreshGithubSnapshotForm slug={slug} />
            ) : null}
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {!data.githubSnapshot ? (
              <div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  暂无 GitHub 数据
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  {data.githubUrl?.trim()
                    ? "点击「刷新 GitHub 数据」从 GitHub 拉取仓库指标（写入快照历史，详情展示最新一条）。"
                    : "请先在编辑页配置 GitHub 仓库地址后再刷新。"}
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
                {data.githubUrl ? (
                  <a
                    href={data.githubUrl}
                    className="mt-2 inline-block text-sm text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                  >
                    打开仓库
                  </a>
                ) : null}
                <p className="mt-3 text-xs text-zinc-500">
                  指标来自已保存的 GitHub 快照；手动刷新会新增一条记录并在此处显示最新数据。
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div data-testid="github-snapshot-stars">
                    <dt className="text-zinc-500">Stars</dt>
                    <dd className="font-medium">{data.githubSnapshot.stars}</dd>
                  </div>
                  <div data-testid="github-snapshot-forks">
                    <dt className="text-zinc-500">Forks</dt>
                    <dd className="font-medium">{data.githubSnapshot.forks}</dd>
                  </div>
                  <div data-testid="github-snapshot-issues">
                    <dt className="text-zinc-500">Open Issues</dt>
                    <dd className="font-medium">{data.githubSnapshot.openIssues}</dd>
                  </div>
                  <div data-testid="github-snapshot-watchers">
                    <dt className="text-zinc-500">Watchers</dt>
                    <dd className="font-medium">{data.githubSnapshot.watchers}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">贡献者（估算）</dt>
                    <dd className="font-medium">{data.githubSnapshot.contributorsCount}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">默认分支</dt>
                    <dd className="font-medium">{data.githubSnapshot.defaultBranch ?? "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-zinc-500">最近仓库活动</dt>
                    <dd className="font-medium">
                      {data.githubSnapshot.lastCommitAt
                        ? data.githubSnapshot.lastCommitAt.toLocaleString("zh-CN")
                        : "—"}
                    </dd>
                  </div>
                  {data.githubSnapshot.fetchedAt ? (
                    <div className="sm:col-span-3">
                      <dt className="text-zinc-500">最近抓取时间</dt>
                      <dd className="font-medium" data-testid="github-snapshot-fetched-at">
                        {data.githubSnapshot.fetchedAt.toLocaleString("zh-CN")}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </>
            )}
          </div>
        </section>

        <section className="mb-10" aria-labelledby="social-heading">
          <h2 id="social-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            社媒
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {socials.length === 0 ? (
              <li className="text-sm text-zinc-500">暂无社媒账号</li>
            ) : (
              socials.map((s) => (
                <li
                  key={`${s.platform}-${s.accountName}`}
                  className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <p className="text-xs font-medium text-zinc-500">{socialPlatformLabel(s.platform)}</p>
                  {s.accountUrl ? (
                    <a
                      href={s.accountUrl}
                      className="mt-1 block font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {s.accountName}
                    </a>
                  ) : (
                    <p className="mt-1 font-medium">{s.accountName}</p>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="mb-10" aria-labelledby="project-updates-heading" data-testid="project-updates-section">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2
              id="project-updates-heading"
              className="text-sm font-semibold uppercase tracking-wide text-zinc-500"
            >
              项目动态
            </h2>
            {fromDb ? (
              <Link
                href={`/dashboard/projects/${slug}/updates/new`}
                className="text-xs font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
              >
                发布动态
              </Link>
            ) : null}
          </div>
          <p className="mb-3 text-xs text-zinc-500">最近动态按发布时间倒序</p>
          <ul className="space-y-4">
            {data.updates.length === 0 ? (
              <li className="text-sm text-zinc-500">暂无项目动态</li>
            ) : (
              data.updates.map((u, i) => {
                const displayAt = u.createdAt ?? u.occurredAt;
                return (
                  <li
                    key={u.id ?? `update-${u.title}-${displayAt.toISOString()}-${i}`}
                    data-testid="project-update-item"
                    className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-xs font-medium text-zinc-500">
                        {updateSourceTypeLabel(u.sourceType)}
                      </span>
                      <time className="text-xs text-zinc-400" dateTime={displayAt.toISOString()}>
                        {displayAt.toLocaleString("zh-CN")}
                      </time>
                    </div>
                    <p className="mt-1 font-medium">{u.title}</p>
                    {u.content ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{u.content}</p>
                    ) : u.summary ? (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{u.summary}</p>
                    ) : null}
                    {u.sourceUrl ? (
                      <a
                        href={u.sourceUrl}
                        className="mt-2 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
                      >
                        查看来源
                      </a>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </section>

        <section aria-labelledby="about-heading">
          <h2 id="about-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            项目介绍
          </h2>
          <p className="leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
            {descriptionText}
          </p>
        </section>
      </div>
    </div>
  );
}
