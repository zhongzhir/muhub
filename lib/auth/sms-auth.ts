/**
 * 手机号验证码登录：生成、落库、调用 {@link SmsProvider}、频控。
 */
import { prisma } from "@/lib/prisma";
import { getSmsProvider } from "@/lib/auth/sms-provider";
import {
  generateSixDigitCode,
  hashPhoneVerificationCode,
  isValidMainlandMobile,
  normalizeMainlandPhone,
  PHONE_CODE_EXPIRES_MINUTES,
  PHONE_CODE_PURPOSE_LOGIN,
  PHONE_SEND_COOLDOWN_SEC,
  PHONE_SEND_MAX_PER_24H,
} from "@/lib/auth/phone-code";

export type SendPhoneLoginCodeErrorCode =
  | "disabled"
  | "no_database"
  | "invalid_phone"
  | "rate_limited_cooldown"
  | "rate_limited_daily"
  | "send_failed";

export type SendPhoneLoginCodeResult =
  | { ok: true; devCode?: string }
  | { ok: false; error: SendPhoneLoginCodeErrorCode };

function isPhoneLoginEnabled(): boolean {
  return process.env.PHONE_LOGIN_ENABLED?.trim() !== "false";
}

/** 创建登录验证码并触发发送（经由 provider）；dev 环境可在返回值中带 devCode 便于联调。 */
export async function requestPhoneLoginCode(rawPhone: string): Promise<SendPhoneLoginCodeResult> {
  if (!isPhoneLoginEnabled()) {
    return { ok: false, error: "disabled" };
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "no_database" };
  }

  const phone = normalizeMainlandPhone(rawPhone);
  if (!phone || !isValidMainlandMobile(phone)) {
    return { ok: false, error: "invalid_phone" };
  }

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const dayCount = await prisma.phoneVerificationCode.count({
    where: {
      phone,
      purpose: PHONE_CODE_PURPOSE_LOGIN,
      createdAt: { gte: dayAgo },
    },
  });
  if (dayCount >= PHONE_SEND_MAX_PER_24H) {
    return { ok: false, error: "rate_limited_daily" };
  }

  const last = await prisma.phoneVerificationCode.findFirst({
    where: { phone, purpose: PHONE_CODE_PURPOSE_LOGIN },
    orderBy: { createdAt: "desc" },
  });
  if (last && now.getTime() - last.createdAt.getTime() < PHONE_SEND_COOLDOWN_SEC * 1000) {
    return { ok: false, error: "rate_limited_cooldown" };
  }

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

  try {
    const send = await getSmsProvider().sendVerificationCode({
      phone,
      code,
      purpose: "login",
    });
    if (!send.ok) {
      return { ok: false, error: "send_failed" };
    }
  } catch {
    return { ok: false, error: "send_failed" };
  }

  const devPayload =
    process.env.NODE_ENV !== "production" ? { ok: true as const, devCode: code } : { ok: true as const };

  return devPayload;
}
