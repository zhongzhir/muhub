export type SmsPurpose = "login";

export type SendVerificationCodeInput = {
  phone: string;
  code: string;
  purpose: SmsPurpose;
};

export type SmsSendResult = { ok: true } | { ok: false; message: string; code?: string; requestId?: string };

export interface SmsProvider {
  sendVerificationCode(input: SendVerificationCodeInput): Promise<SmsSendResult>;
}
