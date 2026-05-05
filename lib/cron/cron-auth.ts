import { NextResponse } from "next/server";

/**
 * Vercel Cron 鉴权工具
 *
 * Vercel 在触发 Cron Job 时会自动附加：
 *   Authorization: Bearer $CRON_SECRET
 *
 * 本工具同时支持：
 *   1. Vercel 自动附加的 Bearer token（生产 Cron 触发）
 *   2. 手动 curl 调用（需在 Header 里手动附加相同 token）
 *
 * 使用方法：
 *   const authError = verifyCronAuth(req);
 *   if (authError) return authError;
 */
export function verifyCronAuth(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();

  // 未配置 CRON_SECRET：拒绝所有调用（防止意外暴露）
  if (!secret) {
    console.error("[cron-auth] CRON_SECRET 未配置，拒绝请求");
    return new NextResponse(JSON.stringify({ error: "cron not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token || token !== secret) {
    return new NextResponse(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null; // 通过
}

/** 统一的 Cron 响应格式 */
export function cronResponse(
  data: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json({ ok: status < 400, ...data }, { status });
}
