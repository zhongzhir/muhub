/**
 * 短信 Provider 工厂：与具体服务商（开发环境 Mock、后续阿里云等）解耦。
 * 后续接入阿里云时实现 {@link SmsProvider} 并在下方按配置分支返回。
 */

import type { SmsProvider } from "@/lib/auth/sms-types";
import { DevSmsProvider } from "@/lib/auth/providers/dev-sms-provider";

export type { SmsPurpose, SendVerificationCodeInput, SmsSendResult, SmsProvider } from "@/lib/auth/sms-types";

export function getSmsProvider(): SmsProvider {
  const id = process.env.SMS_PROVIDER?.trim().toLowerCase();
  if (id === "aliyun") {
    throw new Error(
      "SMS_PROVIDER=aliyun 已预留但未实现；开发请省略或使用默认 dev provider。",
    );
  }
  return new DevSmsProvider();
}
