/** 是否可管理项目（编辑、发动态等） */
export function canManageProject(
  userId: string | undefined,
  row: { createdById: string | null; claimedByUserId: string | null },
): boolean {
  if (!userId) {
    return false;
  }
  if (row.createdById === userId || row.claimedByUserId === userId) {
    return true;
  }
  /** 历史数据：尚无归属用户时，允许任意已登录用户操作（与上线前行为接近） */
  if (!row.createdById && !row.claimedByUserId) {
    return true;
  }
  return false;
}
