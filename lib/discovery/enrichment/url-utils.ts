/**
 * Enrichment：规范化 URL，去除 hash、常见追踪参数与尾部斜杠（路径非根时）。
 */
export function normalizeEnrichmentUrl(raw: string): string | null {
  const t = raw
    .trim()
    .replace(/^<+|>+$/g, "")
    .replace(/[),.;:，。、]+$/u, "");
  if (!/^https?:\/\//i.test(t)) {
    return null;
  }
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return null;
    }
    const host = u.hostname.toLowerCase();
    if (!host) {
      return null;
    }
    u.hostname = host;
    u.hash = "";
    for (const k of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "ref",
      "fbclid",
    ]) {
      u.searchParams.delete(k);
    }
    let out = u.toString();
    if (out.endsWith("/") && u.pathname !== "/" && u.pathname !== "") {
      out = out.replace(/\/+$/, "");
    }
    return out;
  } catch {
    return null;
  }
}

export function hostFromNormalizedUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}
