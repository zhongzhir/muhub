import type { SocialPlatform } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { demoProjectView, type DemoSocial, type ProjectPageView } from "@/lib/demo-project";
import { mapProjectRowToView } from "@/lib/map-project-row";
import { prisma } from "@/lib/prisma";
import { projectStatusLabel } from "@/lib/project-status";
import { socialPlatformLabel } from "@/lib/social-platform";
import { updateSourceTypeLabel } from "@/lib/update-source";

export const dynamic = "force-dynamic";

const SOCIAL_ORDER: SocialPlatform[] = [
  "WEIBO",
  "WECHAT_OFFICIAL",
  "WECHAT_CHANNELS",
  "DOUYIN",
  "XIAOHONGSHU",
  "BILIBILI",
  "X",
  "DISCORD",
  "REDDIT",
];

function sortSocials(socials: DemoSocial[]): DemoSocial[] {
  return [...socials].sort((a, b) => {
    const ia = SOCIAL_ORDER.indexOf(a.platform);
    const ib = SOCIAL_ORDER.indexOf(b.platform);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

async function loadFromDb(slug: string): Promise<ProjectPageView | null> {
  if (!process.env.DATABASE_URL?.trim()) {
    return null;
  }
  try {
    const row = await prisma.project.findUnique({
      where: { slug },
      include: {
        socialAccounts: true,
        updates: { orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }], take: 20 },
        githubSnapshots: { orderBy: { fetchedAt: "desc" }, take: 1 },
      },
    });
    if (!row) {
      return null;
    }
    return mapProjectRowToView(row);
  } catch (e) {
    console.error("[project page] loadFromDb", e);
    return null;
  }
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const fromDb = await loadFromDb(slug);
  const data: ProjectPageView | null =
    fromDb ?? (slug === demoProjectView.slug ? demoProjectView : null);

  if (!data) {
    notFound();
  }

  const socials = sortSocials(data.socials);

  const descriptionText = data.description.trim()
    ? data.description
    : "暂无项目介绍";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="mb-6 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
        </p>

        <header className="mb-10 border-b border-zinc-200 pb-8 dark:border-zinc-800">
          <p className="text-sm font-medium text-zinc-500">项目主页</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{data.name}</h1>
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

        <section className="mb-10" aria-labelledby="github-heading">
          <h2 id="github-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            GitHub 卡片
          </h2>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="font-mono text-sm text-zinc-800 dark:text-zinc-200">
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
              指标数据来自 GitHub 仓库快照；新建项目默认无自动同步，故可能显示为 0。
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-zinc-500">Stars</dt>
                <dd className="font-medium">{data.githubSnapshot.stars}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Forks</dt>
                <dd className="font-medium">{data.githubSnapshot.forks}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Open issues</dt>
                <dd className="font-medium">{data.githubSnapshot.openIssues}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">贡献者</dt>
                <dd className="font-medium">{data.githubSnapshot.contributorsCount}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">7d commits</dt>
                <dd className="font-medium">{data.githubSnapshot.commitCount7d}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">30d commits</dt>
                <dd className="font-medium">{data.githubSnapshot.commitCount30d}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">默认分支</dt>
                <dd className="font-medium">{data.githubSnapshot.defaultBranch ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">最近提交</dt>
                <dd className="font-medium">
                  {data.githubSnapshot.lastCommitAt
                    ? data.githubSnapshot.lastCommitAt.toLocaleDateString("zh-CN")
                    : "—"}
                </dd>
              </div>
            </dl>
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

        <section className="mb-10" aria-labelledby="feed-heading">
          <h2 id="feed-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            动态流
          </h2>
          <ul className="space-y-4">
            {data.updates.length === 0 ? (
              <li className="text-sm text-zinc-500">暂无项目动态</li>
            ) : (
              data.updates.map((u, i) => (
                <li
                  key={`${u.title}-${i}`}
                  className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-xs font-medium text-zinc-500">
                      {updateSourceTypeLabel(u.sourceType)}
                    </span>
                    <time className="text-xs text-zinc-400">
                      {u.occurredAt.toLocaleString("zh-CN")}
                    </time>
                  </div>
                  <p className="mt-1 font-medium">{u.title}</p>
                  {u.summary ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{u.summary}</p> : null}
                  {u.sourceUrl ? (
                    <a
                      href={u.sourceUrl}
                      className="mt-2 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      查看来源
                    </a>
                  ) : null}
                </li>
              ))
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
