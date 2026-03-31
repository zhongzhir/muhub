/**
 * 与 Prisma 查询合并：`deletedAt: null` 表示未软删除。
 * slug 唯一冲突校验（如新项目分配 slug）请勿使用本过滤，以免与已删行撞 slug。
 */
export const PROJECT_ACTIVE_FILTER = { deletedAt: null } as const;

/** 项目广场、匿名 sitemap / 分享可见：已公开且未删除 */
export const PROJECT_PLAZA_FILTER = {
  deletedAt: null,
  visibilityStatus: "PUBLISHED" as const,
} as const;
