/**
 * 项目来源与生命周期标签：产品统一文案与样式（中文优先）。
 */

import type { ClaimStatus, ProjectStatus } from "@prisma/client";
import { isRecommendedProject } from "@/lib/recommended-projects";

export type BadgeVariant =
  | "amber"
  | "violet"
  | "sky"
  | "slate"
  | "zinc"
  | "emerald"
  | "emeraldSolid"
  | "outline"
  | "orange";

export type ProjectDisplayBadge = {
  key: string;
  label: string;
  variant: BadgeVariant;
  /** 供 Playwright 等挂 data-testid */
  testId?: string;
};

export type ProjectBadgeContext = {
  slug: string;
  fromDb: boolean;
  sourceType?: string | null;
  isFeatured?: boolean;
  claimStatus: ClaimStatus;
  status: ProjectStatus;
};

/** 来源类标签（推荐 / 种子 / 导入 / 手工 / 演示 / 精选） */
export function buildProjectSourceBadges(ctx: ProjectBadgeContext): ProjectDisplayBadge[] {
  const badges: ProjectDisplayBadge[] = [];

  if (!ctx.fromDb) {
    if (isRecommendedProject(ctx.slug)) {
      badges.push({ key: "src-recommended", label: "推荐项目", variant: "amber" });
    } else if (ctx.slug === "demo") {
      badges.push({ key: "src-demo", label: "演示", variant: "zinc" });
    }
    return badges;
  }

  const st = (ctx.sourceType ?? "").trim().toLowerCase();
  if (st === "seed") {
    badges.push({ key: "src-seed", label: "种子项目", variant: "violet" });
  } else if (st === "import") {
    badges.push({ key: "src-import", label: "仓库导入", variant: "sky" });
  } else {
    badges.push({ key: "src-manual", label: "手工创建", variant: "slate" });
  }

  if (ctx.isFeatured) {
    badges.push({ key: "src-featured", label: "精选", variant: "orange" });
  }

  return badges;
}

/** 发布状态 + 认领状态（仅库内项目展示「未认领」） */
export function buildProjectLifecycleBadges(ctx: ProjectBadgeContext): ProjectDisplayBadge[] {
  const badges: ProjectDisplayBadge[] = [];

  if (ctx.status === "DRAFT") {
    badges.push({ key: "life-draft", label: "草稿", variant: "zinc" });
  } else if (ctx.status === "ACTIVE") {
    badges.push({ key: "life-active", label: "已发布", variant: "emerald" });
  } else {
    badges.push({ key: "life-archived", label: "已归档", variant: "slate" });
  }

  if (ctx.fromDb) {
    if (ctx.claimStatus === "CLAIMED") {
      badges.push({
        key: "life-claimed",
        label: "已认领",
        variant: "emeraldSolid",
      });
    } else {
      badges.push({ key: "life-unclaimed", label: "未认领", variant: "outline" });
    }
  }

  return badges;
}

export function buildProjectBadgeGroups(ctx: ProjectBadgeContext): {
  source: ProjectDisplayBadge[];
  lifecycle: ProjectDisplayBadge[];
} {
  return {
    source: buildProjectSourceBadges(ctx),
    lifecycle: buildProjectLifecycleBadges(ctx),
  };
}

const baseBadge = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";

/** 详情 / 广场等浅色背景 */
export function projectBadgeClass(variant: BadgeVariant, theme: "light" | "dark" = "light"): string {
  if (theme === "dark") {
    switch (variant) {
      case "amber":
        return `${baseBadge} bg-amber-400/90 text-amber-950`;
      case "violet":
        return `${baseBadge} bg-violet-400/90 text-violet-950`;
      case "sky":
        return `${baseBadge} bg-sky-400/90 text-sky-950`;
      case "slate":
        return `${baseBadge} bg-white/20 text-zinc-100`;
      case "zinc":
        return `${baseBadge} bg-white/15 text-zinc-200`;
      case "emerald":
        return `${baseBadge} bg-emerald-400/85 text-emerald-950`;
      case "emeraldSolid":
        return `${baseBadge} bg-emerald-400/90 text-emerald-950`;
      case "outline":
        return `${baseBadge} border border-white/35 bg-white/10 text-zinc-100`;
      case "orange":
        return `${baseBadge} bg-orange-400/90 text-orange-950`;
      default:
        return `${baseBadge} bg-white/15 text-zinc-100`;
    }
  } // light / card
  switch (variant) {
    case "amber":
      return `${baseBadge} bg-amber-100 text-amber-900 dark:bg-amber-900/45 dark:text-amber-100`;
    case "violet":
      return `${baseBadge} bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100`;
    case "sky":
      return `${baseBadge} bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100`;
    case "slate":
      return `${baseBadge} bg-slate-100 text-slate-800 dark:bg-slate-800/80 dark:text-slate-100`;
    case "zinc":
      return `${baseBadge} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`;
    case "emerald":
      return `${baseBadge} bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100`;
    case "emeraldSolid":
      return `${baseBadge} bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950`;
    case "outline":
      return `${baseBadge} border border-zinc-300 bg-white text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300`;
    case "orange":
      return `${baseBadge} bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100`;
    default:
      return `${baseBadge} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`;
  }
}
