export type ProjectShareMetricAction = "copyLink" | "copyText" | "twitter";

export type ProjectShareLocalMetrics = {
  copyLink: number;
  copyText: number;
  twitter: number;
};

const STORAGE_PREFIX = "muhub:project-share:v1:";

const emptyMetrics = (): ProjectShareLocalMetrics => ({
  copyLink: 0,
  copyText: 0,
  twitter: 0,
});

function safeParse(raw: string | null): ProjectShareLocalMetrics | null {
  if (raw == null || raw === "") {
    return null;
  }
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== "object" || v === null) {
      return null;
    }
    const o = v as Record<string, unknown>;
    const copyLink = typeof o.copyLink === "number" && Number.isFinite(o.copyLink) ? Math.max(0, Math.floor(o.copyLink)) : 0;
    const copyText = typeof o.copyText === "number" && Number.isFinite(o.copyText) ? Math.max(0, Math.floor(o.copyText)) : 0;
    const twitter = typeof o.twitter === "number" && Number.isFinite(o.twitter) ? Math.max(0, Math.floor(o.twitter)) : 0;
    return { copyLink, copyText, twitter };
  } catch {
    return null;
  }
}

/** 优先 slug；无 slug 时用 canonicalUrl 做稳定本地键（不请求网络） */
export function resolveProjectShareStorageId(slug: string, canonicalUrl: string): string {
  const s = slug.trim();
  if (s) {
    return s;
  }
  try {
    const u = new URL(canonicalUrl);
    return `${u.host}${u.pathname}`.replace(/\s+/g, "") || canonicalUrl;
  } catch {
    return canonicalUrl.trim() || "_muhub-share";
  }
}

function metricsStorageKey(storageId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(storageId)}`;
}

export function readProjectShareLocalMetrics(storageId: string): ProjectShareLocalMetrics {
  if (typeof window === "undefined") {
    return emptyMetrics();
  }
  try {
    const parsed = safeParse(window.localStorage.getItem(metricsStorageKey(storageId)));
    return parsed ?? emptyMetrics();
  } catch {
    return emptyMetrics();
  }
}

export function incrementProjectShareLocalMetric(
  storageId: string,
  action: ProjectShareMetricAction,
): ProjectShareLocalMetrics {
  const base = readProjectShareLocalMetrics(storageId);
  const next: ProjectShareLocalMetrics = {
    ...base,
    [action]: base[action] + 1,
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(metricsStorageKey(storageId), JSON.stringify(next));
    } catch {
      /* ignore quota / private mode */
    }
  }
  return next;
}

export function totalShareActions(m: ProjectShareLocalMetrics): number {
  return m.copyLink + m.copyText + m.twitter;
}
