import { createHash, randomInt } from "crypto";

/** 登录验证码用途，便于后续扩展 */
export const PHONE_CODE_PURPOSE_LOGIN = "login";

/** 验证码有效时长（分钟） */
export const PHONE_CODE_EXPIRES_MINUTES = 5;

/** 同一手机号两次发送最短间隔（秒） */
export const PHONE_SEND_COOLDOWN_SEC = 60;

/** 滚动 24 小时内同一手机号最多发送次数 */
export const PHONE_SEND_MAX_PER_24H = 10;

/** 滚动 1 小时内同一 IP 最多发送次数 */
export const PHONE_SEND_MAX_PER_IP_HOUR = 30;

/** 单条验证码允许校验失败次数，超过后作废 */
export const PHONE_VERIFY_MAX_ATTEMPTS = 5;

const CN_MOBILE_RE = /^1[3-9]\d{9}$/;

export function normalizeMainlandPhone(raw: string): string {
  return raw.replace(/\D/g, "").trim();
}

export function isValidMainlandMobile(phone: string): boolean {
  return CN_MOBILE_RE.test(phone);
}

function codePepper(): string {
  return (process.env.AUTH_SECRET ?? process.env.PHONE_CODE_PEPPER ?? "dev-phone-pepper").trim();
}

export function hashPhoneVerificationCode(phone: string, code: string): string {
  const p = normalizeMainlandPhone(phone);
  return createHash("sha256").update(`${p}:${code}:${codePepper()}`, "utf8").digest("hex");
}

export function hashPhoneCodeIp(ip: string): string {
  return createHash("sha256").update(`ip:${ip.trim()}:${codePepper()}`, "utf8").digest("hex");
}

export function generateSixDigitCode(): string {
  return String(randomInt(100_000, 1_000_000));
}
