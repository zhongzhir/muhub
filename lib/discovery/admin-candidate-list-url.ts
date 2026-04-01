/** 合并管理端候选列表查询串（保留现有参数，覆盖 patch） */
export function mergeAdminCandidateListUrl(
  current: URLSearchParams,
  patch: Record<string, string | undefined | null>,
): string {
  const u = new URLSearchParams(current.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null || v === "") {
      u.delete(k);
    } else {
      u.set(k, v);
    }
  }
  const q = u.toString();
  return q ? `/admin/discovery?${q}` : "/admin/discovery";
}
