import type { SmsProvider } from "@/lib/auth/sms-types";
import { DevSmsProvider } from "@/lib/auth/providers/dev-sms-provider";
import { HttpSmsProvider } from "@/lib/auth/providers/http-sms-provider";

export type { SendVerificationCodeInput, SmsProvider, SmsPurpose, SmsSendResult } from "@/lib/auth/sms-types";

export function getSmsProvider(): SmsProvider {
  const id = process.env.SMS_PROVIDER?.trim().toLowerCase();

  if (id === "http") {
    const endpoint = process.env.SMS_HTTP_ENDPOINT?.trim();
    if (!endpoint) {
      throw new Error("SMS_PROVIDER=http 需要配置 SMS_HTTP_ENDPOINT");
    }
    return new HttpSmsProvider(endpoint);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("生产环境必须配置可用的短信服务商，例如 SMS_PROVIDER=http");
  }

  return new DevSmsProvider();
}
