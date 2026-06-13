import { NextResponse, type NextRequest } from "next/server";
import NextAuth from "next-auth";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import authConfig from "@/auth.config";
import { isTrainingHost } from "@/lib/pwa/training-host";

let rlAuth: Ratelimit | null = null;
let rlInternal: Ratelimit | null = null;
let rlGeneral: Ratelimit | null = null;
let redisReady = false;

function initRatelimiters() {
  if (redisReady) return;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;

  const redis = new Redis({ url, token });

  rlAuth = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "rl:auth",
    ephemeralCache: new Map(),
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
  if (pathname.startsWith("/api/auth/")) {
    return { limiter: rlAuth, max: 30 };
  }
  if (pathname.startsWith("/api/internal/")) {
    return { limiter: rlInternal, max: 10 };
  }
  return { limiter: rlGeneral, max: 120 };
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

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

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") ?? "";
  const normalizedHost = host.split(":")[0]?.toLowerCase() ?? "";

  const isMainMuHubHost =
    normalizedHost === "muhub.cn" ||
    normalizedHost === "www.muhub.cn" ||
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1";

  if (isMainMuHubHost && (pathname === "/training" || pathname.startsWith("/training/"))) {
    const url = new URL(`https://training.muhub.cn${pathname === "/training" ? "" : pathname}`);
    url.search = req.nextUrl.search;
    return NextResponse.redirect(url);
  }

  if (isTrainingHost(host)) {
    const passthrough =
      pathname === "/login" ||
      pathname === "/auth" ||
      pathname.startsWith("/auth/") ||
      pathname === "/api/auth" ||
      pathname.startsWith("/api/auth/") ||
      pathname.startsWith("/training") ||
      pathname.startsWith("/api/") ||
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/icons/") ||
      pathname === "/apple-touch-icon.png" ||
      pathname === "/icon.png" ||
      pathname === "/favicon.ico";

    if (passthrough) {
      return NextResponse.next();
    }

    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? "/training" : `/training${pathname}`;
    return NextResponse.rewrite(url);
  }

  if (pathname.startsWith("/api/")) {
    initRatelimiters();

    const ip = getClientIp(req);
    const { limiter, max } = getRatelimiter(pathname);

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
      console.error("[middleware] Rate limit check failed, allowing request");
      return NextResponse.next();
    }

    const rlHeaders: Record<string, string> = {
      "X-RateLimit-Limit": String(max),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(Math.ceil(reset / 1000)),
    };

    if (!success) {
      return new NextResponse(JSON.stringify({ error: "Too many requests", retryAfter: 60 }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "60",
          ...rlHeaders,
        },
      });
    }

    const res = NextResponse.next();
    for (const [k, v] of Object.entries(rlHeaders)) {
      res.headers.set(k, v);
    }
    return res;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (auth as any)(req);
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/me/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
