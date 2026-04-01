const PRODUCT_HUNT_GRAPHQL_URL = "https://api.producthunt.com/v2/api/graphql";

export type ProductHuntGraphqlOk<T> = { ok: true; data: T };
export type ProductHuntGraphqlErr = {
  ok: false;
  error: string;
  status?: number;
};

/**
 * Product Hunt GraphQL v2。需环境变量 `PRODUCTHUNT_ACCESS_TOKEN`（Bearer）。
 * @see https://api.producthunt.com/v2/docs
 */
export async function productHuntGraphql<T>(
  body: { query: string; variables?: Record<string, unknown> },
): Promise<ProductHuntGraphqlOk<T> | ProductHuntGraphqlErr> {
  const token = process.env.PRODUCTHUNT_ACCESS_TOKEN?.trim();
  if (!token) {
    return {
      ok: false,
      error:
        "未配置 PRODUCTHUNT_ACCESS_TOKEN（Product Hunt Developer Token / OAuth 客户端令牌）",
    };
  }

  let res: Response;
  try {
    res = await fetch(PRODUCT_HUNT_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      next: { revalidate: 0 },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Product Hunt 请求失败: ${msg}` };
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      error: `Product Hunt 返回非 JSON（HTTP ${res.status})`,
      status: res.status,
    };
  }

  if (!res.ok) {
    const msg =
      typeof (json as { message?: string }).message === "string"
        ? (json as { message: string }).message
        : `HTTP ${res.status}`;
    return { ok: false, error: msg, status: res.status };
  }

  const errors = (json as { errors?: { message: string }[] }).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return {
      ok: false,
      error: errors.map((e) => e.message).join("; "),
      status: res.status,
    };
  }

  const data = (json as { data?: T }).data;
  if (data === undefined) {
    return { ok: false, error: "Product Hunt 响应缺少 data", status: res.status };
  }

  return { ok: true, data };
}
