import DysmsapiClient, { SendSmsRequest } from "@alicloud/dysmsapi20170525";
import { Config as OpenApiConfig } from "@alicloud/openapi-client";
import type { SendVerificationCodeInput, SmsProvider, SmsSendResult } from "@/lib/auth/sms-types";

type AliyunSmsConfig = {
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
  region: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`阿里云短信缺少环境变量 ${name}`);
  }
  return value;
}

function loadConfig(): AliyunSmsConfig {
  return {
    accessKeyId: requiredEnv("ALIYUN_ACCESS_KEY_ID"),
    accessKeySecret: requiredEnv("ALIYUN_ACCESS_KEY_SECRET"),
    signName: requiredEnv("ALIYUN_SMS_SIGN_NAME"),
    templateCode: requiredEnv("ALIYUN_SMS_TEMPLATE_CODE"),
    region: process.env.ALIYUN_SMS_REGION?.trim() || "cn-hangzhou",
  };
}

export class AliyunSmsProvider implements SmsProvider {
  private readonly config: AliyunSmsConfig;
  private readonly client: DysmsapiClient;

  constructor(config = loadConfig()) {
    this.config = config;
    this.client = new DysmsapiClient(
      new OpenApiConfig({
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
        regionId: config.region,
      }),
    );
  }

  async sendVerificationCode(input: SendVerificationCodeInput): Promise<SmsSendResult> {
    const request = new SendSmsRequest({
      phoneNumbers: input.phone,
      signName: this.config.signName,
      templateCode: this.config.templateCode,
      templateParam: JSON.stringify({ code: input.code }),
    });

    const response = await this.client.sendSms(request);
    const body = response.body;
    if (body?.code === "OK") {
      return { ok: true };
    }

    return {
      ok: false,
      message: `阿里云短信发送失败 code=${body?.code ?? "UNKNOWN"} message=${body?.message ?? ""}`,
    };
  }
}
