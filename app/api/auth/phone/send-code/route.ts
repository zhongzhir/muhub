import { NextResponse } from "next/server";
import { requestPhoneLoginCode } from "@/lib/auth/sms-auth";

/**
 * POST { "phone": "13800138000" }
 * 成功：{ ok: true, devCode?: string }（devCode 仅非 production）
 * 失败：{ ok: false, error: string }
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const raw =
    typeof body === "object" && body !== null && "phone" in body
      ? String((body as { phone?: unknown }).phone ?? "")
      : "";

  const result = await requestPhoneLoginCode(raw);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
