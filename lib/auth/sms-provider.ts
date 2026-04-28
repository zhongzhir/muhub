import type { SmsProvider } from "@/lib/auth/sms-types";
import { AliyunSmsProvider } from "@/lib/auth/providers/aliyun-sms-provider";
import { DevSmsProvider } from "@/lib/auth/providers/dev-sms-provider";
import { HttpSmsProvider } from "@/lib/auth/providers/http-sms-provider";

export type { SendVerificationCodeInput, SmsProvider, SmsPurpose, SmsSendResult } from "@/lib/auth/sms-types";

export function getSmsProvider(): SmsProvider {
  const id = process.env.SMS_PROVIDER?.trim().toLowerCase();

  if (id === "dev") {
    return new DevSmsProvider();
  }

  if (id === "http") {
    const endpoint = process.env.SMS_HTTP_ENDPOINT?.trim();
    if (!endpoint) {
      throw new Error("SMS_PROVIDER=http 需要配置 SMS_HTTP_ENDPOINT");
    }
    return new HttpSmsProvider(endpoint);
  }

  if (id === "aliyun") {
    return new AliyunSmsProvider();
  }

  if (process.env.NODE_ENV === "production") {
    console.error("[sms] 生产环境未配置 SMS_PROVIDER，请设置为 aliyun、http 或 dev");
    throw new Error("生产环境必须配置可用的短信服务商");
  }

  return new DevSmsProvider();
}
