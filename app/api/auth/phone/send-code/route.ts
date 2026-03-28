import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPhoneLoginCode } from "@/lib/auth/send-phone-code";
import {
  generateSixDigitCode,
  hashPhoneVerificationCode,
  isValidMainlandMobile,
  normalizeMainlandPhone,
  PHONE_CODE_EXPIRES_MINUTES,
  PHONE_CODE_PURPOSE_LOGIN,
  PHONE_SEND_COOLDOWN_SEC,
  PHONE_SEND_MAX_PER_HOUR,
} from "@/lib/auth/phone-code";

function phoneLoginEnabled(): boolean {
  return process.env.PHONE_LOGIN_ENABLED?.trim() !== "false";
}

/**
 * POST { "phone": "13800138000" }
 * 统一返回 { ok: true }，避免枚举手机号是否注册。
 */
export async function POST(req: Request) {
  if (!phoneLoginEnabled()) {
    return NextResponse.json({ ok: true });
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ ok: true });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const raw = typeof body === "object" && body !== null && "phone" in body
    ? String((body as { phone?: unknown }).phone ?? "")
    : "";
  const phone = normalizeMainlandPhone(raw);

  if (!phone || !isValidMainlandMobile(phone)) {
    return NextResponse.json({ ok: true });
  }

  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const recentCount = await prisma.phoneVerificationCode.count({
    where: {
      phone,
      purpose: PHONE_CODE_PURPOSE_LOGIN,
      createdAt: { gte: hourAgo },
    },
  });
  if (recentCount >= PHONE_SEND_MAX_PER_HOUR) {
    return NextResponse.json({ ok: true });
  }

  const last = await prisma.phoneVerificationCode.findFirst({
    where: { phone, purpose: PHONE_CODE_PURPOSE_LOGIN },
    orderBy: { createdAt: "desc" },
  });
  if (last && now.getTime() - last.createdAt.getTime() < PHONE_SEND_COOLDOWN_SEC * 1000) {
    return NextResponse.json({ ok: true });
  }

  // TODO: 基于 IP（如 x-forwarded-for）的补充限流

  const code = generateSixDigitCode();
  const codeHash = hashPhoneVerificationCode(phone, code);
  const expiresAt = new Date(now.getTime() + PHONE_CODE_EXPIRES_MINUTES * 60 * 1000);

  await prisma.phoneVerificationCode.create({
    data: {
      phone,
      codeHash,
      purpose: PHONE_CODE_PURPOSE_LOGIN,
      expiresAt,
    },
  });

  await sendPhoneLoginCode(phone, code);

  return NextResponse.json({ ok: true });
}
