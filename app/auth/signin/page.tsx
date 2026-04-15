import Link from "next/link";
import { GitHubSignInButton } from "@/components/auth/github-sign-in-button";
import { PhoneLoginForm } from "@/components/auth/phone-login-form";

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

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; redirect?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const callbackUrl = safeCallbackUrl(sp.redirect ?? sp.callbackUrl);
  const showPhoneLogin = process.env.PHONE_LOGIN_ENABLED !== "false";

  return (
    <div className="min-h-[70vh] bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-md px-6 py-16">
        <p className="mb-6 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">登录 MUHUB</h1>
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">系统测试中...</p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          创建项目、管理资料与发布动态前请先登录。可使用 GitHub
          {showPhoneLogin ? " 或手机号验证码" : ""}。
          {showPhoneLogin
            ? " 认领绑定 GitHub 的公开仓库项目时，目前需使用 GitHub 登录。"
            : null}
        </p>

        {sp.error ? (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          >
            登录遇到问题，请稍后再试或检查环境变量是否配置完整。
          </p>
        ) : null}

        <section aria-labelledby="github-login-heading" className="mt-8">
          <h2 id="github-login-heading" className="sr-only">
            GitHub 登录
          </h2>
          <div className="flex flex-col items-stretch">
            <GitHubSignInButton callbackUrl={callbackUrl} />
          </div>
          <p className="mt-4 text-center text-xs text-zinc-500">
            使用 GitHub 登录即表示授权读取公开资料（头像、用户名等）用于展示。
          </p>
        </section>

        {showPhoneLogin ? (
          <>
            <div className="relative my-10" aria-hidden>
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-200 dark:border-zinc-700" />
              </div>
              <div className="relative flex justify-center text-xs font-medium uppercase tracking-wide text-zinc-400">
                <span className="bg-zinc-50 px-3 dark:bg-zinc-950">或</span>
              </div>
            </div>

            <section aria-labelledby="phone-login-heading">
              <h2 id="phone-login-heading" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                手机号验证码登录
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                仅支持中国大陆 11 位手机号。亦可前往{" "}
                <Link
                  href={`/auth/phone?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                  className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                >
                  手机号登录专页
                </Link>
                。
              </p>
              <div className="mt-5">
                <PhoneLoginForm callbackUrl={callbackUrl} />
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
