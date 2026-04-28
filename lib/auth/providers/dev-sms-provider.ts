import type { SendVerificationCodeInput, SmsProvider, SmsSendResult } from "@/lib/auth/sms-types";

export class DevSmsProvider implements SmsProvider {
  async sendVerificationCode(input: SendVerificationCodeInput): Promise<SmsSendResult> {
    console.info(`[sms:dev] purpose=${input.purpose} phone=${input.phone} code=${input.code}`);
    return { ok: true };
  }
}
