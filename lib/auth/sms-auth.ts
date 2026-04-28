import { prisma } from "@/lib/prisma";
import { getSmsProvider } from "@/lib/auth/sms-provider";
import {
  generateSixDigitCode,
  hashPhoneCodeIp,
  hashPhoneVerificationCode,
  isValidMainlandMobile,
  normalizeMainlandPhone,
  PHONE_CODE_EXPIRES_MINUTES,
  PHONE_CODE_PURPOSE_LOGIN,
  PHONE_SEND_COOLDOWN_SEC,
  PHONE_SEND_MAX_PER_IP_HOUR,
  PHONE_SEND_MAX_PER_24H,
} from "@/lib/auth/phone-code";

export type SendPhoneLoginCodeErrorCode =
  | "disabled"
  | "no_database"
  | "invalid_phone"
  | "rate_limited_cooldown"
  | "rate_limited_daily"
  | "rate_limited_ip"
  | "send_failed";

export type SendPhoneLoginCodeResult = { ok: true } | { ok: false; error: SendPhoneLoginCodeErrorCode };

export type RequestPhoneLoginCodeOptions = {
  ip?: string | null;
};

function isPhoneLoginEnabled(): boolean {
  return process.env.PHONE_LOGIN_ENABLED?.trim() !== "false";
}

export async function requestPhoneLoginCode(
  rawPhone: string,
  options: RequestPhoneLoginCodeOptions = {},
): Promise<SendPhoneLoginCodeResult> {
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
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const ipHash = options.ip ? hashPhoneCodeIp(options.ip) : null;

  if (ipHash) {
    const ipHourCount = await prisma.phoneVerificationCode.count({
      where: {
        ipHash,
        purpose: PHONE_CODE_PURPOSE_LOGIN,
        createdAt: { gte: hourAgo },
      },
    });
    if (ipHourCount >= PHONE_SEND_MAX_PER_IP_HOUR) {
      return { ok: false, error: "rate_limited_ip" };
    }
  }

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
      ipHash,
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
  } catch (error) {
    console.error("[sms] send verification code failed", error);
    return { ok: false, error: "send_failed" };
  }

  return { ok: true };
}
