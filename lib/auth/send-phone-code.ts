/**
 * 短信发送抽象：MVP 仅开发环境打日志；生产可接阿里云/腾讯云等。
 */
export async function sendPhoneLoginCode(phone: string, code: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[phone-login] code for ${phone}: ${code}`);
    return;
  }

  // TODO: 生产环境接入 SMS 服务商（需配置密钥与模板）
}
