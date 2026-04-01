import { tagsFromJson } from "@/lib/discovery/score-candidate";

/** 与列表筛选 isPopular 阈值一致 */
export const DISCOVERY_POPULAR_MIN_STARS = 200;
/** isFresh：仓库更新或最近提交在多少天内 */
export const DISCOVERY_FRESH_MAX_AGE_DAYS = 30;
/** hasRecentCommit：最近提交在多少天内 */
export const DISCOVERY_RECENT_COMMIT_MAX_AGE_DAYS = 14;

export type DiscoveryCandidateQualitySignals = {
  hasWebsite: boolean;
  hasDocs: boolean;
  hasTwitter: boolean;
  hasRepo: boolean;
  hasDescription: boolean;
  hasTopics: boolean;
  hasRecentCommit: boolean;
  isPopular: boolean;
  isFresh: boolean;
};

export type QualitySignalSource = {
  website: string | null;
  docsUrl: string | null;
  twitterUrl: string | null;
  repoUrl: string | null;
  descriptionRaw: string | null;
  summary: string | null;
  tagsJson: unknown;
  lastCommitAt: Date | null;
  repoUpdatedAt: Date | null;
  stars: number;
};

function nonEmpty(s: string | null | undefined): boolean {
  return Boolean(s?.trim());
}

function withinDays(d: Date | null, maxAgeDays: number): boolean {
  if (!d) {
    return false;
  }
  const ms = Date.now() - d.getTime();
  return ms >= 0 && ms <= maxAgeDays * 24 * 60 * 60 * 1000;
}

export function computeDiscoveryCandidateQualitySignals(
  row: QualitySignalSource,
): DiscoveryCandidateQualitySignals {
  const hasWebsite = nonEmpty(row.website);
  const hasDocs = nonEmpty(row.docsUrl);
  const hasTwitter = nonEmpty(row.twitterUrl);
  const hasRepo = nonEmpty(row.repoUrl);
  const hasDescription = nonEmpty(row.descriptionRaw) || nonEmpty(row.summary);
  const hasTopics = tagsFromJson(row.tagsJson).length > 0;
  const hasRecentCommit = withinDays(
    row.lastCommitAt,
    DISCOVERY_RECENT_COMMIT_MAX_AGE_DAYS,
  );
  const isPopular = row.stars >= DISCOVERY_POPULAR_MIN_STARS;
  const isFresh =
    withinDays(row.repoUpdatedAt, DISCOVERY_FRESH_MAX_AGE_DAYS) ||
    withinDays(row.lastCommitAt, DISCOVERY_FRESH_MAX_AGE_DAYS);

  return {
    hasWebsite,
    hasDocs,
    hasTwitter,
    hasRepo,
    hasDescription,
    hasTopics,
    hasRecentCommit,
    isPopular,
    isFresh,
  };
}
