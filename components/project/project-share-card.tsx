"use client";

export type ProjectShareCardProps = {
  name: string;
  subtitle: string;
  slug: string;
  canonicalUrl: string;
  tags?: string[];
  category?: string | null;
  claimStatus?: 'CLAIMED' | 'UNCLAIMED';
};

export function ProjectShareCard({
  name,
  subtitle,
  slug,
  canonicalUrl,
  tags = [],
  category,
  claimStatus,
}: ProjectShareCardProps) {
  const isClaimed = claimStatus === 'CLAIMED';
  const chips = [category, ...tags].filter((item): item is string => Boolean(item?.trim())).slice(0, 4);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-md dark:border-zinc-700 dark:bg-zinc-900"
      data-testid="project-share-card"
    >
      <div className={`h-1 w-full ${isClaimed ? 'bg-gradient-to-r from-teal-500 to-blue-500' : 'bg-zinc-200 dark:bg-zinc-700'}`} />

      <div className="p-5">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white dark:bg-white dark:text-zinc-900"
            >
              M
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">MUHUB</p>
          </div>
          {isClaimed ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              ✦ 官方认证主页
            </span>
          ) : (
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              项目档案
            </span>
          )}
        </div>

        <h2 className="text-2xl font-bold leading-snug tracking-tight text-zinc-950 dark:text-zinc-50">
          {name}
        </h2>

        <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          {subtitle.trim() || "在 MUHUB 查看项目详情与最新动态。"}
        </p>

        {chips.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {chip.startsWith("#") ? chip : `#${chip}`}
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/50">
          <span className="text-xs text-zinc-400" aria-hidden>🔗</span>
          <p className="min-w-0 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            {canonicalUrl || `/projects/${slug}`}
          </p>
        </div>
    