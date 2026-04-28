function toDate(input?: string | Date | null): Date | null {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatRelativeUpdateTime(input?: string | Date | null): string {
  const d = toDate(input);
  if (!d) return "";
  const now = Date.now();
  const diffMs = Math.max(0, now - d.getTime());
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / dayMs);

  if (days <= 0) return "今天更新";
  if (days < 7) return `${days} 天前更新`;
  if (days < 30) {
    const weeks = Math.max(1, Math.floor(days / 7));
    return `${weeks} 周前更新`;
  }
  const months = Math.max(1, Math.floor(days / 30));
  return `${months} 个月前更新`;
}

export function getProjectActivityStatus(input?: string | Date | null): string {
  const d = toDate(input);
  if (!d) return "";
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 7) return "本周活跃";
  if (days <= 30) return "近期更新";
  return "近期较安静";
}
