import Link from "next/link";
import { notFound } from "next/navigation";
import { loadProjectPageView, sortProjectSocials } from "@/lib/load-project-page-view";
import { formatListDate } from "@/lib/format-date";
import { socialPlatformLabel } from "@/lib/social-platform";
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

  const { data } = loaded;
  const socials = sortProjectSocials(data.socials);
  const descriptionText = data.description.trim()
    ? data.description
    : "暂无项目介绍";

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100 to-zinc-200 px-4 py-10 text-zinc-900 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-50">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">分享项目</p>
          <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
            <Link href={`/projects/${slug}`} className="underline-offset-4 hover:underline">
              完整主页
            </Link>
            <Link href="/" className="underline-offset-4 hover:underline">
              MUHUB
            </Link>
          </div>
        </div>

        <article className="rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-lg dark:border-zinc-700/80 dark:bg-zinc-900">
          <header className="border-b border-zinc-100 pb-6 dark:border-zinc-800">
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="share-project-name">
              {data.name}
            </h1>
            {data.tagline ? (
              <p
                className="mt-2 text-base text-zinc-600 dark:text-zinc-400"
                data-testid="share-project-tagline"
              >
                {data.tagline}
              </p>
            ) : (
              <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">暂无简介</p>
            )}
            <p className="mt-4 text-xs text-zinc-500">
              创建于 {formatListDate(data.createdAt)}
            </p>
          </header>

          <section className="border-b border-zinc-100 py-6 dark:border-zinc-800">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">项目介绍</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {descriptionText}
            </p>
          </section>

          <section className="border-b border-zinc-100 py-6 dark:border-zinc-800">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">链接</h2>
            <ul className="flex flex-wrap gap-4 text-sm">
              <li>
                {data.githubUrl ? (
                  <a
                    href={data.githubUrl}
                    className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                  >
                    GitHub
                  </a>
                ) : (
                  <span className="text-zinc-400">GitHub —</span>
                )}
              </li>
              <li>
                {data.websiteUrl ? (
                  <a
                    href={data.websiteUrl}
                    className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                  >
                    官网
                  </a>
                ) : (
                  <span className="text-zinc-400">官网 —</span>
                )}
              </li>
            </ul>
          </section>

          <section className="py-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">社媒</h2>
            {socials.length === 0 ? (
              <p className="text-sm text-zinc-400">—</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {socials.map((s) => (
                  <li key={`${s.platform}-${s.accountName}`} className="flex gap-2">
                    <span className="shrink-0 text-zinc-500">{socialPlatformLabel(s.platform)}</span>
                    {s.accountUrl ? (
                      <a
                        href={s.accountUrl}
                        className="truncate font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {s.accountName}
                      </a>
                    ) : (
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">{s.accountName}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <footer className="border-t border-zinc-100 pt-6 dark:border-zinc-800">
            <CopyLinkButton />
          </footer>
        </article>
      </div>
    </div>
  );
}
