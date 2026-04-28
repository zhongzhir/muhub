import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BindGitHubButton } from "@/components/settings/bind-github-button";
import { prisma } from "@/lib/prisma";

function authErrorMessage(error: string | undefined): string | null {
  if (!error) {
    return null;
  }
  if (error === "OAuthAccountNotLinked" || error === "AccountNotLinked") {
    return "该 GitHub 账号已绑定其他用户，无法绑定到当前账号。";
  }
  return "GitHub 绑定失败，请稍后重试。";
}

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?redirect=${encodeURIComponent("/settings/account")}`);
  }

  const sp = await searchParams;
  const errorMessage = authErrorMessage(sp?.error);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      accounts: {
        where: { provider: "github" },
        select: { providerAccountId: true },
        take: 1,
      },
    },
  });

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent("/settings/account")}`);
  }

  const githubAccount = user.accounts[0] ?? null;

  return (
    <div className="min-h-[70vh] bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p className="mb-6 flex flex-wrap gap-4 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
          <Link href="/dashboard" className="underline-offset-4 hover:underline">
            我的项目
          </Link>
        </p>

        <h1 className="text-2xl font-semibold tracking-tight">账号设置</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          管理手机号登录与 GitHub 账号绑定。绑定后可继续使用手机号登录，同时用于 GitHub 项目认领校验。
        </p>

        {errorMessage ? (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          >
            {errorMessage}
          </p>
        ) : null}

        <section className="muhub-card mt-8 space-y-5 p-5 sm:p-6" aria-labelledby="account-identity-heading">
          <div>
            <h2 id="account-identity-heading" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              登录身份
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              一个 MUHUB 账号可以同时拥有手机号和 GitHub 登录方式。
            </p>
          </div>

          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <dt className="font-medium text-zinc-700 dark:text-zinc-300">手机号</dt>
              <dd className="mt-2 text-zinc-900 dark:text-zinc-100">{user.phone ?? "未绑定"}</dd>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <dt className="font-medium text-zinc-700 dark:text-zinc-300">GitHub</dt>
              <dd className="mt-2 text-zinc-900 dark:text-zinc-100">
                {githubAccount ? `已绑定（ID ${githubAccount.providerAccountId}）` : "未绑定"}
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {githubAccount ? (
              <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                GitHub 已绑定
              </span>
            ) : (
              <BindGitHubButton callbackUrl="/settings/account" />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
