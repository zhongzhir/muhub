/**
 * Discovery V2 基础版：本地 JSON 队列项类型，与 Prisma DiscoveryCandidate 并存、渐进衔接。
 */

export type DiscoverySourceType =
  | "github"
  | "manual"
  | "rss"
  | "rss-producthunt"
  | "rss-github"
  | "twitter"
  | "other";

export type DiscoveryStatus = "new" | "reviewed" | "imported" | "rejected";
export type DiscoveryAiStatus = "scheduled" | "done" | "failed";

export type DiscoveryItem = {
  id: string;
  sourceType: DiscoverySourceType;
  title: string;
  url: string;
  description?: string;
  projectSlug?: string;
  status: DiscoveryStatus;
  aiStatus?: DiscoveryAiStatus;
  aiUpdatedAt?: string;
  createdAt: string;
};
