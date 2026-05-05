import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

/** 与 Playwright 对齐：非 HTTPS 开发/CI 使用无前缀 Cookie 名 */
const SESSION_COOKIE_NAME = "authjs.session-token";
const E2E_USER_EMAIL = "e2e-playwright@muhub.internal";

/**
 * 仅用于 E2E：在持有 E2E_TEST_SECRET 时签发与 NextAuth JWT 会话一致的 cookie 值。
 *
 * 安全策略（三层防护）：
 *  1. 生产环境（NODE_ENV=production）下若未配置 E2E_TEST_SECRET，直接 404。
 *  2. E2E_TEST_SECRET 必须 ≥ 32 字符，防止弱口令被猜测。
 *  3. 请求头 x-e2e-secret 须与 E2E_TEST_SECRET 完全匹配。
 *
 * ⚠️  生产部署时请勿设置 E2E_TEST_SECRET 环境变量。
 */
export async function POST(req: Request) {
  const gate = process.env.E2E_TEST_SECRET?.trim();

  // 生产环境：未配置则直接封闭
  if (process.env.NODE_ENV === "production" && !gate) {
    return new NextResponse(null, { status: 404 });
  }

  // 弱口令检测：< 32 字符视为未配置
  if (!gate || gate.length < 32) {
    return new NextResponse(null, { status: 404 });
  }

  const incoming = req.headers.get("x-e2e-secret");
  if (incoming !== gate) {
    return new NextResponse(null, { status: 404 });
  }

  // 生产环境调用时记录审计日志（不泄露 secret）
  if (process.env.NODE_ENV === "production") {
    console.warn("[e2e/auth-token] called in production – verify this is intentional");
  }

  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "AUTH_SECRET 未配置" }, { status: 500 });
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL 未配置" }, { status: 500 });
  }

  const user = await prisma.user.upsert({
    where: { email: E2E_USER_EMAIL },
    create: {
      email: E2E_USER_EMAIL,
      name: "E2E Playwright",
    },
    update: {
      name: "E2E Playwright",
    },
  });

  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: "github",
        providerAccountId: "e2e-playwright-fixture-github",
      },
    },
    create: {
      userId: user.id,
      type: "oauth",
      provider: "github",
      providerAccountId: "e2e-playwright-fixture-github",
    },
    update: { userId: user.id },
  });

  const sessionToken = await encode({
    token: {
      sub: user.id,
      name: user.name ?? "E2E Playwright",
      email: user.email ?? E2E_USER_EMAIL,
    },
    secret,
    salt: SESSION_COOKIE_NAME,
    maxAge: 30 * 24 * 60 * 60,
  });

  return NextResponse.json({ sessionToken, userId: user.id });
}
