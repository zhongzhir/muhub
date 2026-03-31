import type { ProjectStatus, ProjectVisibilityStatus, SocialPlatform } from "@prisma/client";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";

/** 编辑表单支持的四个社媒平台（与创建页一致） */
export const EDIT_SOCIAL_PLATFORMS: SocialPlatform[] = [
  "WEIBO",
  "WECHAT_OFFICIAL",
  "DOUYIN",
  "XIAOHONGSHU",
];

export type ProjectEditInitial = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  githubUrl: string;
  websiteUrl: string;
  visibilityStatus: ProjectVisibilityStatus;
  status: ProjectStatus;
  weibo: string;
  wechat_official: string;
  douyin: string;
  xiaohongshu: string;
};

/** 回填展示：优先显示用户可能保存过的链接，否则显示账号名 */
export function formatSocialInputValue(accountName: string, accountUrl: string | null): string {
  const url = accountUrl?.trim();
  if (url) {
    return url;
  }
  return accountName.trim();
}

export async function fetchProjectForEdit(slug: string): Promise<ProjectEditInitial | null> {
  if (!process.env.DATABASE_URL?.trim()) {
    return null;
  }

  const row = await prisma.project.findFirst({
    where: { slug, ...PROJECT_ACTIVE_FILTER },
    include: { socialAccounts: true },
  });

  if (!row) {
    return null;
  }

  const byPlatform = new Map<SocialPlatform, (typeof row.socialAccounts)[0]>();
  for (const acc of row.socialAccounts) {
    byPlatform.set(acc.platform, acc);
  }

  const pick = (p: SocialPlatform): string => {
    const acc = byPlatform.get(p);
    if (!acc) {
      return "";
    }
    return formatSocialInputValue(acc.accountName, acc.accountUrl);
  };

  return {
    slug: row.slug,
    name: row.name,
    tagline: row.tagline ?? "",
    description: row.description ?? "",
    githubUrl: row.githubUrl ?? "",
    websiteUrl: row.websiteUrl ?? "",
    visibilityStatus: row.visibilityStatus,
    status: row.status,
    weibo: pick("WEIBO"),
    wechat_official: pick("WECHAT_OFFICIAL"),
    douyin: pick("DOUYIN"),
    xiaohongshu: pick("XIAOHONGSHU"),
  };
}
