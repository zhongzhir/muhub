import Link from "next/link";
import { projectPublicPathPrefix } from "@/lib/seo/site";
import { formatListDate } from "@/lib/format-date";

export type ProjectDetailHeroProps = {
  slug: string;
  name: string;
  tagline: string | undefined;
  createdAt: Date;
  /** 库内项目且当前用户可管理时展示编辑/发布动态 */
  canManage: boolean;
};

const btnBase =
  "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition";
const btnPrimary = `${btnBase} bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white`;
const btnSecondary = `${btnBase} border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800`;

export function ProjectDetailHero({
  slug,
  name,
  tagline,
  createdAt,
  canManage,
}: ProjectDetailHeroProps) {
  const pathPrefix = projectPublicPathPrefix();
  const publicPath = `${pathPrefix}${slug}`;

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50 px-6 py-8 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950 md:px-10 md:py-10"
      aria-labelledby="project-detail-title"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">项目主页</p>

      <h1
        id="project-detail-title"
        className="mt-2 text-4xl font-bold tracking-tight text-zinc-900 md:text-5xl dark:text-zinc-50"
      >
        {name}
      </h1>

      {tagline?.trim() ? (
        <>
          <h2 id="project-tagline-heading" className="sr-only">
            项目简介
          </h2>
          <p
            className="mt-4 max-w-3xl text-lg leading-snug text-zinc-600 dark:text-zinc-400"
            aria-labelledby="project-tagline-heading"
          >
            {tagline}
          </p>
        </>
      ) : null}

      <dl className="mt-6 grid gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-zinc-500">项目访问地址</dt>
          <dd className="break-all font-mono text-zinc-800 dark:text-zinc-200">{publicPath}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-zinc-500">创建时间</dt>
          <dd>{formatListDate(createdAt)}</dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-zinc-200/80 pt-6 sm:gap-3 dark:border-zinc-800">
        <Link href={`/projects/${slug}/share`} className={btnPrimary}>
          分享项目
        </Link>
        {canManage ? (
          <Link href={`/dashboard/projects/${slug}/edit`} className={btnSecondary}>
            编辑项目
          </Link>
        ) : null}
        {canManage ? (
          <Link href={`/dashboard/projects/${slug}/updates/new`} className={btnSecondary}>
            发布动态
          </Link>
        ) : null}
      </div>

      <div className="mt-4">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline dark:hover:text-zinc-300"
        >
          ← 返回首页
        </Link>
      </div>
    </section>
  );
}
