import Link from "next/link";
import { PhoneLoginForm } from "@/components/auth/phone-login-form";
import { GitHubSignInButton } from "@/components/auth/github-sign-in-button";

function safeCallbackUrl(raw: string | undefined): string {
  if (typeof raw !== "string") {
    return "/dashboard";
  }
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) {
    return "/dashboard";
  }
  return t;
}

export default async function PhoneAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const callbackUrl = safeCallbackUrl(sp.callbackUrl);
  const showPhoneLogin = process.env.PHONE_LOGIN_ENABLED !== "false";

  if (!showPhoneLogin) {
    return (
      <div className="min-h-[70vh] bg-zinc-50 px-6 py-16 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-md">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">手机号登录未启用。</p>
          <p className="mt-4">
            <Link href={`/login?redirect=${encodeURIComponent(callbackUrl)}`} className="underline">
              返回登录页
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-md px-6 py-16">
        <p className="mb-6 flex flex-wrap gap-4 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
          <Link
            href={`/login?redirect=${encodeURIComponent(callbackUrl)}`}
            className="underline-offset-4 hover:underline"
          >
            其它登录方式
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">手机号登录</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          使用中国大陆手机号与验证码登录或注册。
        </p>

        <section aria-labelledby="phone-flow-heading" className="mt-8">
          <h2 id="phone-flow-heading" className="sr-only">
            手机号与验证码
          </h2>
          <PhoneLoginForm callbackUrl={callbackUrl} />
        </section>

        <div className="relative my-10" aria-hidden>
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-zinc-200 dark:border-zinc-700" />
          </div>
          <div className="relative flex justify-center text-xs font-medium uppercase tracking-wide text-zinc-400">
            <span className="bg-zinc-50 px-3 dark:bg-zinc-950">或</span>
          </div>
        </div>

        <section aria-labelledby="github-from-phone-page">
          <h2 id="github-from-phone-page" className="sr-only">
            GitHub 登录
          </h2>
          <GitHubSignInButton callbackUrl={callbackUrl} />
        </section>
      </div>
    </div>
  );
}
