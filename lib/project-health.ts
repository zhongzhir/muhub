import type { GithubSnapshotView } from "@/lib/demo-project";
import { computeGithubActivity } from "@/lib/github-activity";

export type ProjectHealthBadge = {
  label: string;
  variant: "emerald" | "sky" | "zinc";
};

/**
 * 基于最新仓库快照与既有活跃度规则得到健康度标签（与「活跃度」文案一致：活跃项目 / 持续维护 / 低活跃）。
 */
export function computeProjectHealth(snapshot: GithubSnapshotView | null): ProjectHealthBadge | null {
  if (!snapshot) {
    return null;
  }
  const { label } = computeGithubActivity(snapshot);
  if (label === "活跃项目") {
    return { label, variant: "emerald" };
  }
  if (label === "持续维护") {
    return { label, variant: "sky" };
  }
  return { label, variant: "zinc" };
}

export function projectHealthBadgeClass(variant: ProjectHealthBadge["variant"]): string {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset";
  switch (variant) {
    case "emerald":
      return `${base} bg-emerald-50 text-emerald-900 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-400/25`;
    case "sky":
      return `${base} bg-sky-50 text-sky-900 ring-sky-600/15 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-400/20`;
    case "zinc":
    default:
      return `${base} bg-zinc-100 text-zinc-600 ring-zinc-500/15 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-400/20`;
  }
}
