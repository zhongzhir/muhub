export type FetchWithRetryOptions = {
  method?: "GET" | "HEAD";
  timeoutMs?: number;
  retries?: number;
  retryDelaysMs?: number[];
  headers?: Record<string, string>;
  cache?: RequestCache;
  /** HTML/text body size cap (default 1.5MB) */
  maxBytes?: number;
  allowedContentTypes?: string[];
  redirect?: RequestRedirect;
};

export type FetchWithRetryResult = {
  ok: boolean;
  status: number;
  finalUrl: string;
  text: string | null;
  contentType: string | null;
  error?: string;
};

const DEFAULT_RETRY_DELAYS_MS = [2_000, 5_000, 10_000];
const DEFAULT_MAX_BYTES = 1_500_000;

async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readLimitedText(resp: Response, maxBytes: number): Promise<string> {
  const reader = resp.body?.getReader();
  if (!reader) {
    const text = await resp.text();
    return text.length > maxBytes ? text.slice(0, maxBytes) : text;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done || !value) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      chunks.push(value.slice(0, Math.max(0, value.byteLength - (total - maxBytes))));
      break;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {},
): Promise<FetchWithRetryResult> {
  const method = options.method ?? "GET";
  const timeoutMs = options.timeoutMs ?? 30_000;
  const retries = options.retries ?? DEFAULT_RETRY_DELAYS_MS.length;
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const allowedContentTypes = options.allowedContentTypes;
  const maxAttempts = retries + 1;
  let lastError = "fetch failed";

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await sleepMs(retryDelaysMs[attempt - 1] ?? retryDelaysMs.at(-1) ?? 2_000);
    }
    try {
      const resp = await fetch(url, {
        method,
        redirect: options.redirect ?? "follow",
        cache: options.cache ?? "no-store",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "Accept-Encoding": "gzip, deflate, br",
          ...(options.headers ?? {}),
        },
      });
      const finalUrl = resp.url || url;
      const contentType = resp.headers.get("content-type");
      if (!resp.ok) {
        lastError = `HTTP ${resp.status}`;
        continue;
      }
      if (allowedContentTypes?.length && contentType) {
        const allowed = allowedContentTypes.some((item) => contentType.includes(item));
        if (!allowed) {
          lastError = `unsupported content-type: ${contentType}`;
          continue;
        }
      }
      const text =
        method === "HEAD"
          ? null
          : await readLimitedText(resp, maxBytes);
      return {
        ok: true,
        status: resp.status,
        finalUrl,
        text,
        contentType,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    ok: false,
    status: 0,
    finalUrl: url,
    text: null,
    contentType: null,
    error: lastError,
  };
}

export async function fetchHeadWithRetry(
  url: string,
  options?: Omit<FetchWithRetryOptions, "method">,
): Promise<FetchWithRetryResult> {
  return fetchWithRetry(url, { ...options, method: "HEAD" });
}

export async function fetchTextWithRetry(
  url: string,
  options?: Omit<FetchWithRetryOptions, "method">,
): Promise<FetchWithRetryResult> {
  return fetchWithRetry(url, { ...options, method: "GET" });
}
