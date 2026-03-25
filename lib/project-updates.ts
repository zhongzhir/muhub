import type { ProjectUpdateSourceType } from "@prisma/client";

/**
 * 产品层统一来源：详情/分享/未来多源接入共用。
 */
export type UpdateOriginKind =
  | "manual"
  | "repo"
  | "social"
  | "official"
  | "ai"
  | "system";

/** 动态流展示所需最小字段（DB / Demo 均可） */
export type ProjectUpdateStreamFields = {
  sourceType: ProjectUpdateSourceType;
  sourceLabel?: string | null;
  isAiGenerated?: boolean | null;
};

export function mapSourceTypeToOrigin(sourceType: ProjectUpdateSourceType): UpdateOriginKind {
  switch (sourceType) {
    case "MANUAL":
      return "manual";
    case "GITHUB":
      return "repo";
    case "SOCIAL":
      return "social";
    case "OFFICIAL":
      return "official";
    case "AI":
      return "ai";
    case "SYSTEM":
    default:
      return "system";
  }
}

const ORIGIN_DEFAULT_LABEL: Record<UpdateOriginKind, string> = {
  manual: "手动发布",
  repo: "代码仓库",
  social: "社交媒体",
  official: "官方动态",
  ai: "AI 摘要",
  system: "系统",
};

/** 列表/分享行主标题旁的来源文案（优先自定义 sourceLabel） */
export function getUpdateStreamPrimaryLabel(u: ProjectUpdateStreamFields): string {
  const custom = u.sourceLabel?.trim();
  if (custom) return custom;
  if (u.isAiGenerated) return "AI 摘要";
  const origin = mapSourceTypeToOrigin(u.sourceType);
  return ORIGIN_DEFAULT_LABEL[origin];
}

export function projectUpdateStreamBadgeClass(origin: UpdateOriginKind): string {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset";
  switch (origin) {
    case "manual":
      return `${base} bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-400/30`;
    case "repo":
      return `${base} bg-sky-50 text-sky-800 ring-sky-600/15 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-400/25`;
    case "social":
      return `${base} bg-pink-50 text-pink-800 ring-pink-600/15 dark:bg-pink-950/35 dark:text-pink-200 dark:ring-pink-400/25`;
    case "official":
      return `${base} bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-400/25`;
    case "ai":
      return `${base} bg-amber-50 text-amber-900 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-400/25`;
    case "system":
    default:
      return `${base} bg-zinc-100 text-zinc-600 ring-zinc-500/10 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-400/20`;
  }
}

/** 构造展示模型（供详情流等） */
export function buildProjectUpdateStreamModel(u: ProjectUpdateStreamFields) {
  const origin = mapSourceTypeToOrigin(u.sourceType);
  const primaryLabel = getUpdateStreamPrimaryLabel(u);
  const badgeOrigin: UpdateOriginKind =
    u.sourceType === "AI" || Boolean(u.isAiGenerated) ? "ai" : origin;
  const badgeClass = projectUpdateStreamBadgeClass(badgeOrigin);
  return { origin, primaryLabel, badgeClass, badgeOrigin };
}
