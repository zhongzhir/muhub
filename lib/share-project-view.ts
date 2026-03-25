import type { DemoUpdate } from "@/lib/demo-project";

/** 分享页「最近动态」最多条数 */
export const SHARE_RECENT_UPDATES_LIMIT = 2;

/** 项目名首字（或首字符），用于无 Logo 时的占位 */
export function projectShareInitial(name: string): string {
  const t = name.trim();
  if (!t) {
    return "?";
  }
  const first = [...t][0];
  return first ? first.toLocaleUpperCase("zh-CN") : "?";
}

export function takeRecentUpdatesForShare(updates: DemoUpdate[], limit = SHARE_RECENT_UPDATES_LIMIT): DemoUpdate[] {
  return updates.slice(0, limit);
}
