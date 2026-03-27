import Link from "next/link";
import type { ClaimStatus, ProjectStatus } from "@prisma/client";
import { ProjectBadgeStrip } from "@/components/project/project-badge-strip";
import { buildProjectBadgeGroups } from "@/lib/project-badges";
import { codeHostLinkLabel } from "@/lib/repo-platform";
import type { ProjectHealthBadge } from "@/lib/project-health";
import { projectHealthBadgeClass } from "@/lib/project-health";

export type ProjectDetailHeroProps = {
  slug: string;
  name: string;
  tagline: string | undefined;
  status: ProjectStatus;
  createdAt: Date;
  githubUrl: string | undefined;
  websiteUrl: string | undefined;
  fromDb: boolean;
  showClaimCta: boolean;
  showRecommendedClaim: boolean;
  sourceType?: string | null;
  isFeatured?: boolean;
  claimStatus: ClaimStatus;
  /** 基于仓库快照的健康度（无快照则不展示） */
  health?: ProjectHealthBadge | null;
};

const btnBase =
  "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition";
const btnPrimary = `${btnBase} bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white`;
const btnSecondary = `${btnBase} border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800`;

export function ProjectDetailHero({
  slug,
  name,
  tagline,
  status,
  createdAt,
  githubUrl,
  websiteUrl,
  fromDb,
  showClaimCta,
  showRecommendedClaim,
  sourceType,
  isFeatured,
  claimStatus,
  health,
}: ProjectDetailHeroProps) {
  const groups = buildProjectBadgeGroups({
    slug,
    fromDb,
    sourceType,
    isFeatured,
    claimStatus,
    status,
  });
  const { source } = groups;
  const lifecycleForHero = groups.lifecycle.map((b) =>
    b.key === "life-claimed" ? { ...b, testId: "project-claimed-label" as const } : b,
  );

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

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <ProjectBadgeStrip source={source} lifecycle={lifecycleForHero} theme="light" />
        {health ? (
          <span
            data-testid="project-health-badge"
            className={projectHealthBadgeClass(health.variant)}
          >
            {health.label}
          </span>
        ) : null}
      </div>

      {showRecommendedClaim ? (
        <div
          data-testid="recommended-project-hint"
          className="mt-5 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/25"
        >
          <p className="text-sm font-medium text-amber-950 dark:text-amber-100">这是推荐项目</p>
          <p className="mt-0.5 text-sm text-amber-900/85 dark:text-amber-200/85">认领后可编辑管理</p>
          <Link
            href={`/dashboard/projects/new?from=recommended&slug=${encodeURIComponent(slug)}`}
            data-testid="claim-recommended-button"
            className={`${btnPrimary} mt-3`}
          >
            认领项目
          </Link>
        </div>
      ) : null}

      <section
        className="mt-6 border-t border-zinc-200/80 pt-6 dark:border-zinc-800"
        aria-labelledby="project-primary-links-heading"
      >
        <h2 id="project-primary-links-heading" className="sr-only">
          项目链接
        </h2>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {githubUrl?.trim() ? (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
            >
              {codeHostLinkLabel(githubUrl)} 仓库
            </a>
          ) : (
            <span className="text-zinc-400">未填写代码仓库</span>
          )}
          {websiteUrl?.trim() ? (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
            >
              官网
            </a>
          ) : (
            <span className="text-zinc-400">未填写官网</span>
          )}
        </div>
      </section>

      <div className="mt-6 flex flex-wrap gap-3 border-t border-zinc-200/80 pt-6 dark:border-zinc-800">
        <Link href={`/projects/${slug}/share`} className={btnPrimary}>
          分享项目
        </Link>
        {fromDb ? (
          <Link href={`/dashboard/projects/${slug}/edit`} className={btnSecondary}>
            编辑项目
          </Link>
        ) : null}
        {fromDb ? (
          <Link href={`/dashboard/projects/${slug}/updates/new`} className={btnSecondary}>
            发布动态
          </Link>
        ) : null}
        {showClaimCta ? (
          <Link
            href={`/projects/${slug}/claim`}
            data-testid="claim-project-button"
            className={btnPrimary}
          >
            认领该项目
          </Link>
        ) : null}
      </div>

      <p className="mt-6 text-xs text-zinc-500">
        <span className="font-mono text-zinc-700 dark:text-zinc-300">{slug}</span>
        <span className="mx-2 text-zinc-300 dark:text-zinc-600">·</span>
        创建于 {createdAt.toLocaleString("zh-CN")}
      </p>

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
