"use client";

export type ProjectShareCardProps = {
  name: string;
  subtitle: string;
  slug: string;
  canonicalUrl: string;
  tags?: string[];
  category?: string | null;
};

export function ProjectShareCard({
  name,
  subtitle,
  slug,
  canonicalUrl,
  tags = [],
  category,
}: ProjectShareCardProps) {
  const chips = [category, ...tags].filter((item): item is string => Boolean(item?.trim())).slice(0, 4);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
      data-testid="project-share-card"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
            M
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">MUHUB</p>
            <p className="text-[11px] text-zinc-400">项目推荐卡</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          项目档案
        </span>
      </div>

      <p className="mt-5 text-xl font-bold leading-snug text-zinc-950 dark:text-zinc-50">{name}</p>
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        {subtitle.trim() ? subtitle : "在 MUHUB 查看项目详情与最新动态。"}
      </p>

      {chips.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span key={chip} className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              {chip.startsWith("#") ? chip : `#${chip}`}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-5 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800/70">
        <p className="break-all font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          {canonicalUrl || `/projects/${slug}`}
        </p>
      </div>
    </div>
  );
}
