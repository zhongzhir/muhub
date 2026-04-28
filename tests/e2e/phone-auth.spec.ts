import { expect, test } from "@playwright/test";
import {
  hashPhoneCodeIp,
  hashPhoneVerificationCode,
  isValidMainlandMobile,
  normalizeMainlandPhone,
  PHONE_CODE_EXPIRES_MINUTES,
  PHONE_SEND_COOLDOWN_SEC,
  PHONE_SEND_MAX_PER_IP_HOUR,
  PHONE_VERIFY_MAX_ATTEMPTS,
} from "@/lib/auth/phone-code";

test.describe("手机号验证码登录基础规则", () => {
  test("仅接受中国大陆 11 位手机号", () => {
    expect(normalizeMainlandPhone("+86 138-0013-8000")).toBe("8613800138000");
    expect(isValidMainlandMobile("13800138000")).toBe(true);
    expect(isValidMainlandMobile("12800138000")).toBe(false);
    expect(isValidMainlandMobile("1380013800")).toBe(false);
  });

  test("验证码与 IP 入库前使用 hash", () => {
    const codeHash = hashPhoneVerificationCode("13800138000", "123456");
    const ipHash = hashPhoneCodeIp("203.0.113.10");

    expect(codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(codeHash).not.toContain("123456");
    expect(ipHash).not.toContain("203.0.113.10");
  });

  test("验证码有效期、冷却与错误次数符合登录要求", () => {
    expect(PHONE_CODE_EXPIRES_MINUTES).toBe(5);
    expect(PHONE_SEND_COOLDOWN_SEC).toBe(60);
    expect(PHONE_SEND_MAX_PER_IP_HOUR).toBeGreaterThan(0);
    expect(PHONE_VERIFY_MAX_ATTEMPTS).toBe(5);
  });
});
