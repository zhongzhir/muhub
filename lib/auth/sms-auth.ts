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

function smsProviderType(): string {
  return process.env.SMS_PROVIDER?.trim().toLowerCase() || (process.env.NODE_ENV === "production" ? "unset" : "dev");
}

function phoneLast4(phone: string): string {
  return phone.slice(-4);
}

function errorDetails(error: unknown): { code: string | null; message: string } {
  if (error instanceof Error) {
    const maybeCode = "code" in error && typeof error.code === "string" ? error.code : null;
    return { code: maybeCode, message: error.message };
  }
  if (typeof error === "object" && error !== null) {
    const record = error as { code?: unknown; message?: unknown };
    return {
      code: typeof record.code === "string" ? record.code : null,
      message: typeof record.message === "string" ? record.message : String(error),
    };
  }
  return { code: null, message: String(error) };
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

  const providerType = smsProviderType();

  try {
    const provider = getSmsProvider();
    const send = await provider.sendVerificationCode({
      phone,
      code,
      purpose: "login",
    });
    if (!send.ok) {
      console.error("[sms] send verification code failed", {
        provider: providerType,
        phoneLast4: phoneLast4(phone),
        code: send.code ?? null,
        message: send.message,
      });
      return { ok: false, error: "send_failed" };
    }
  } catch (error) {
    const details = errorDetails(error);
    console.error("[sms] send verification code failed", {
      provider: providerType,
      phoneLast4: phoneLast4(phone),
      code: details.code,
      message: details.message,
    });
    return { ok: false, error: "send_failed" };
  }

  return { ok: true };
}
