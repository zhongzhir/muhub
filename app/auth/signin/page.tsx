import Link from "next/link";
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

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const callbackUrl = safeCallbackUrl(sp.callbackUrl);

  return (
    <div className="min-h-[70vh] bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-md px-6 py-16">
        <p className="mb-6 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">登录 MUHUB</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          创建项目、认领仓库、编辑资料与发布动态前，请先使用 GitHub 账号登录。登录后你会回到刚才访问的页面。
        </p>

        {sp.error ? (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          >
            登录遇到问题，请稍后再试或检查环境变量是否配置完整。
          </p>
        ) : null}

        <div className="mt-8 flex flex-col items-stretch">
          <GitHubSignInButton callbackUrl={callbackUrl} />
        </div>

        <p className="mt-8 text-center text-xs text-zinc-500">
          继续即表示你授权我们读取 GitHub 公开资料（头像、用户名等），用于展示账号信息。
        </p>
      </div>
    </div>
  );
}
