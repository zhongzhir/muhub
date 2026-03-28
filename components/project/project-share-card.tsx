"use client";

import Image from "next/image";

const MARK_W = 365;
const MARK_H = 405;

export type ProjectShareCardProps = {
  name: string;
  /** 卡片副文案（标语或摘要一行化展示） */
  subtitle: string;
  slug: string;
};

/**
 * 分享弹窗内预览用 UI 卡片（非图片生成器）
 */
export function ProjectShareCard({ name, subtitle, slug }: ProjectShareCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-zinc-200/90 bg-gradient-to-br from-white via-zinc-50/90 to-teal-50/30 p-4 shadow-sm dark:border-zinc-600 dark:from-zinc-800/90 dark:via-zinc-900 dark:to-teal-950/20"
      data-testid="project-share-card"
    >
      <div className="absolute right-2 top-2 opacity-[0.92] dark:opacity-95">
        <Image
          src="/brand/muhub_logo_mark.png"
          alt="MUHUB"
          width={MARK_W}
          height={MARK_H}
          className="h-9 w-auto object-contain object-right"
        />
      </div>
      <p className="pr-20 text-base font-bold leading-snug text-zinc-900 dark:text-zinc-50">{name}</p>
      <p className="mt-2 line-clamp-3 min-h-[2.75rem] text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        {subtitle.trim() ? subtitle : "在 MUHUB 查看项目详情与动态"}
      </p>
      <p className="mt-3 break-all font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="text-zinc-400 dark:text-zinc-500">slug </span>
        {slug}
      </p>
    </div>
  );
}
