import type { GithubSnapshotView } from "@/lib/demo-project";

export type GithubActivityResult = {
  label: string;
};

const DAY_MS = 86_400_000;

/**
 * 根据快照中的最近活动时间估算活跃度（优先 lastCommitAt，其次 latestReleaseAt，再退化为 commit 计数）。
 * 规则：7 天内 → 活跃；30 天内 → 中度；否则低活跃。
 */
export function computeGithubActivity(snapshot: GithubSnapshotView): GithubActivityResult {
  const ref = snapshot.lastCommitAt ?? snapshot.latestReleaseAt ?? null;
  if (ref) {
    const daysSince = (Date.now() - ref.getTime()) / DAY_MS;
    if (daysSince <= 7) {
      return { label: "活跃项目" };
    }
    if (daysSince <= 30) {
      return { label: "持续维护" };
    }
    return { label: "低活跃" };
  }

  if ((snapshot.commitCount7d ?? 0) > 0) {
    return { label: "活跃项目" };
  }
  if ((snapshot.commitCount30d ?? 0) > 0) {
    return { label: "持续维护" };
  }

  return { label: "低活跃" };
}
