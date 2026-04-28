import type { SendPhoneLoginCodeErrorCode } from "@/lib/auth/sms-auth";

export function sendCodeErrorStatus(error: SendPhoneLoginCodeErrorCode): number {
  if (error === "rate_limited_cooldown" || error === "rate_limited_daily" || error === "rate_limited_ip") {
    return 429;
  }
  if (error === "disabled") {
    return 403;
  }
  if (error === "send_failed" || error === "no_database") {
    return 503;
  }
  return 400;
}
