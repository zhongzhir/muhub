import type { SendVerificationCodeInput, SmsProvider, SmsSendResult } from "@/lib/auth/sms-types";

function authHeader(): Record<string, string> {
  const header = process.env.SMS_HTTP_AUTH_HEADER?.trim();
  if (!header) {
    return {};
  }

  const splitAt = header.indexOf(":");
  if (splitAt <= 0) {
    return {};
  }

  return {
    [header.slice(0, splitAt).trim()]: header.slice(splitAt + 1).trim(),
  };
}

export class HttpSmsProvider implements SmsProvider {
  constructor(private readonly endpoint: string) {}

  async sendVerificationCode(input: SendVerificationCodeInput): Promise<SmsSendResult> {
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
      },
      body: JSON.stringify({
        phone: input.phone,
        code: input.code,
        purpose: input.purpose,
        signName: process.env.SMS_SIGN_NAME,
        templateCode: process.env.SMS_TEMPLATE_CODE,
      }),
    });

    if (!res.ok) {
      return { ok: false, message: `短信服务返回 ${res.status}` };
    }

    return { ok: true };
  }
}
