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

  if (days <= 0) return "updated today";
  if (days < 7) return `updated ${days} day${days > 1 ? "s" : ""} ago`;
  if (days < 30) {
    const weeks = Math.max(1, Math.floor(days / 7));
    return `updated ${weeks} week${weeks > 1 ? "s" : ""} ago`;
  }
  const months = Math.max(1, Math.floor(days / 30));
  return `updated ${months} month${months > 1 ? "s" : ""} ago`;
}

export function getProjectActivityStatus(input?: string | Date | null): string {
  const d = toDate(input);
  if (!d) return "";
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 7) return "Active this week";
  if (days <= 30) return "Recently updated";
  return "Quiet recently";
}
