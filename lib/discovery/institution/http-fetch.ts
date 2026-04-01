export const INSTITUTION_FETCH_TIMEOUT_MS = 25_000;

export async function fetchInstitutionHtml(
  listUrl: string,
): Promise<{ ok: true; html: string; fetchedUrl: string } | { ok: false; error: string }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), INSTITUTION_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(listUrl, {
      redirect: "follow",
      signal: ac.signal,
      headers: {
        "User-Agent": "MUHUB-Discovery-Institution/1.0 (+https://github.com/zhongzhir/muhub)",
        Accept: "text/html,application/xhtml+xml;q=0.9,application/xml;q=0.8,*/*;q=0.7",
      },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} ${res.statusText}` };
    }
    const html = await res.text();
    return { ok: true, html, fetchedUrl: res.url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  } finally {
    clearTimeout(t);
  }
}
