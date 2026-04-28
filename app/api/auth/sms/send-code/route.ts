import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/auth/request-ip";
import { requestPhoneLoginCode } from "@/lib/auth/sms-auth";
import { sendCodeErrorStatus } from "@/lib/auth/sms-response";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const phone =
    typeof body === "object" && body !== null && "phone" in body
      ? String((body as { phone?: unknown }).phone ?? "")
      : "";

  const result = await requestPhoneLoginCode(phone, { ip: getClientIp(req.headers) });
  if (!result.ok) {
    return NextResponse.json(result, { status: sendCodeErrorStatus(result.error) });
  }

  return NextResponse.json(result);
}
