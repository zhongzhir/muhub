import type { ReactNode } from "react";
import Link from "next/link";
import { projectPublicPathPrefix } from "@/lib/seo/site";
import { formatListDate } from "@/lib/format-date";
import ProjectHeroMetrics from "@/components/project/project-hero-metrics";

export type ProjectDetailHeroProps = {
  slug: string;
  name: string;
  tagline: string | undefined;
  summary?: string;
  highlights?: string[];
  stars?: number;
  lastCommitAt?: string | Date | null;
  contributors?: number;
  createdAt: Date;
  /** 公开页：分享、进入管理等（通常为客户端岛） */
  actions?: ReactNode;
  claimStatus?: "CLAIMED" | "UNCLAIMED";
};

export function ProjectDetailHero({
  slug,
  name,
  tagline,
  summary,
  highlights,
  stars,
  lastCommitAt,
  contributors,
  createdAt,
  actions,
  claimStatus,
}: ProjectDetailHeroProps) {
  const isClaimed = claimStatus === "CLAIMED";
  const pathPrefix = projectPublicPathPrefix();
  const publicPath = `${pathPrefix}${slug}`;
  const initial = name.trim()[0]?.toUpperCase() ?? "P";

  return (
    <section
      className="muhub-detail-hero overflow-hidden rounded-2xl border border-zinc-200/60 bg-white shadow-lg dark:border-zinc-800/80 dark:bg-zinc-950"
      aria-labelledby="project-detail-title"
    >
      {/* ── 深色沉浸式顶部 ─────────────────────────────────────────── */}
      <div className={`relative px-7 pb-8 pt-7 md:px-10 md:pb-10 md:pt-9 ${isClaimed ? "bg-gradient-to-br from-zinc-950 via-zinc-900 to-[#0d2020]" : "bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800"}`}>
        {/* 面包屑导航 */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
            <span className="text-teal-400">MUHUB</span>
            <span className="mx-1.5 text-zinc-700">·</span>
            <span>项目档案</span>
          </p>
          <Link
            href="/"
            className="flex items-center gap-1 text-[11px] font-medium text-zinc-600 transition hover:text-zinc-300"
          >
            <span aria-hidden>←</span>
            返回首页
          </Link>
        </div>

        {/* 头像 + 名称 */}
        <div className="mt-6 flex items-end gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-2xl font-bold tracking-tight text-white shadow-inner"
            aria-hidden
          >
            {initial}
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            {isClaimed ? (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                ✦ 官方认证主页
              </span>
            ) : null}
            <h1
              id="project-detail-title"
              className="text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl"
            >
              {name}
            </h1>
          </div>
        </div>

        {/* 简介 / summary */}
        {(summary?.trim() || tagline?.trim()) ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300">
            {summary?.trim() || tagline}
          </p>
        ) : null}

        {/* 数据指标行 */}
        <ProjectHeroMetrics stars={stars} updatedAt={lastCommitAt} contributors={contributors} />

        {/* Highlight 标签 */}
        {highlights?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {highlights.slice(0, 4).map((h) => (
              <span
                key={h}
                className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium text-zinc-300"
              >
                {h}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* ── 信息条 + 操作栏 ─────────────────────────────────────────── */}
      <div className="border-t border-zinc-100 bg-zinc-50/60 px-7 py-5 md:px-10 dark:border-zinc-800/80 dark:bg-zinc-900/40">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-zinc-500">
          <div className="flex min-w-0 gap-1.5">
            <dt className="shrink-0 font-medium text-zinc-400">访问地址</dt>
            <dd className="min-w-0 break-all font-mono text-zinc-600 dark:text-zinc-300">
              {publicPath}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="font-medium text-zinc-400">收录时间</dt>
            <dd className="text-zinc-600 dark:text-zinc-300">{formatListDate(createdAt)}</dd>
          </div>
        </dl>

        <div className="mt-4" role="toolbar" aria-label="项目快捷操作">
          {actions}
        </div>
      </div>
    </section>
  );
}
