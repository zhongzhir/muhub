import { AuthError } from "next-auth";
import { NextResponse } from "next/server";
import { signIn } from "@/auth";

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
  const code =
    typeof body === "object" && body !== null && "code" in body
      ? String((body as { code?: unknown }).code ?? "")
      : "";

  try {
    await signIn("phone-login", {
      phone,
      code,
      redirect: false,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 401 });
    }
    console.error("[sms] login failed", error);
    return NextResponse.json({ ok: false, error: "login_failed" }, { status: 500 });
  }
}
