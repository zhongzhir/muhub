import { NextResponse, type NextRequest } from "next/server";
import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ─── Rate Limiter（Upstash Redis 分布式滑动窗口） ────────────────────────────
//
// 使用 @upstash/ratelimit + Upstash Redis，跨实例/跨 worker 精确限流。
// 若环境变量未配置（本地无 Redis），自动降级为放行（保开发体验）。
//
// 分级限流：
//   /api/auth/*      → 30 次/分钟（认证接口，最敏感）
//   /api/internal/*  → 10 次/分钟（内部 cron 接口）
//   /api/*           → 120 次/分钟（通用接口）

let rlAuth: Ratelimit | null = null;
let rlInternal: Ratelimit | null = null;
let rlGeneral: Ratelimit | null = null;
let redisReady = false;

function initRatelimiters() {
  if (redisReady) return;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return; // 未配置：降级模式

  const redis = new Redis({ url, token });

  rlAuth = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "rl:auth",
    ephemeralCache: new Map(), // 同实例内命中缓存，减少 Redis 往返
  });

  rlInternal = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "rl:internal",
    ephemeralCache: new Map(),
  });

  rlGeneral = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(120, "1 m"),
    prefix: "rl:general",
    ephemeralCache: new Map(),
  });

  redisReady = true;
}

function getRatelimiter(pathname: string): {
  limiter: Ratelimit | null;
  max: number;
} {
  if (pathname.startsWith("/api/auth/"))
    return { limiter: rlAuth, max: 30 };
  if (pathname.startsWith("/api/internal/"))
    return { limiter: rlInternal, max: 10 };
  return { limiter: rlGeneral, max: 120 };
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

// ─── NextAuth 中间件（仅处理鉴权保护路由） ────────────────────────────────────

const { auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...(authConfig.callbacks ?? {}),
    authorized({ auth: session, request: { nextUrl } }) {
      const path = nextUrl.pathname;
      const protectedRoute =
        path.startsWith("/dashboard") ||
        path.startsWith("/me") ||
        path.startsWith("/settings") ||
        path.startsWith("/admin");

      if (!session?.user && protectedRoute) {
        const redirectPath = `${nextUrl.pathname}${nextUrl.search}`;
        const loginUrl = new URL("/login", nextUrl.origin);
        loginUrl.searchParams.set("redirect", redirectPath);
        return Response.redirect(loginUrl);
      }

      return true;
    },
  },
});

// ─── 主中间件入口 ──────────────────────────────────────────────────────────────

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── 1. API 路由：先限流，通过则放行（不走 Auth 中间件） ──────────────────
  if (pathname.startsWith("/api/")) {
    // 惰性初始化限流器（首次请求时建立 Redis 连接）
    initRatelimiters();

    const ip = getClientIp(req);
    const { limiter, max } = getRatelimiter(pathname);

    // 若 Redis 未配置，直接放行（降级模式）
    if (!limiter) {
      return NextResponse.next();
    }

    let success: boolean;
    let remaining: number;
    let reset: number;

    try {
      const result = await limiter.limit(ip);
      success = result.success;
      remaining = result.remaining;
      reset = result.reset;
    } catch {
      // Redis 连接失败：降级为放行，不阻断请求
      console.error("[middleware] Rate limit check failed, allowing request");
      return NextResponse.next();
    }

    const rlHeaders: Record<string, string> = {
      "X-RateLimit-Limit": String(max),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(Math.ceil(reset / 1000)),
    };

    if (!success) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests", retryAfter: 60 }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
            ...rlHeaders,
          },
        },
      );
    }

    const res = NextResponse.next();
    for (const [k, v] of Object.entries(rlHeaders)) {
      res.headers.set(k, v);
    }
    return res;
  }

  // ── 2. 鉴权保护路由：委托给 NextAuth ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (auth as any)(req);
}

export const config = {
  matcher: [
    // 鉴权保护路由（NextAuth 处理）
    "/dashboard/:path*",
    "/me/:path*",
    "/settings/:path*",
    "/admin/:path*",
    // API 路由（限流处理）
    "/api/:path*",
  ],
};
