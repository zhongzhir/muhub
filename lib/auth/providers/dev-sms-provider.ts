import type { SmsProvider, SendVerificationCodeInput, SmsSendResult } from "@/lib/auth/sms-types";

/**
 * 开发 / 测试用：不真实发短信，仅打日志。
 * 生产环境应换用阿里云等 {@link SmsProvider} 实现（通过 env 选择 getSmsProvider() 分支）。
 */
export class DevSmsProvider implements SmsProvider {
  async sendVerificationCode(input: SendVerificationCodeInput): Promise<SmsSendResult> {
    // 方案 A：服务端日志（推荐，不经过 HTTP 响应）
    console.info(
      `[DevSmsProvider] SMS mock | purpose=${input.purpose} | phone=${input.phone} | code=${input.code}`,
    );
    return { ok: true };
  }
}
