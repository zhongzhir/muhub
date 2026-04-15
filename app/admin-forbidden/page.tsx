import Link from "next/link";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function AdminForbiddenPage() {
  const session = await auth();
  const userId = session?.user?.id ?? "unknown";
  const userEmail = session?.user?.email ?? "unknown";

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">管理员权限未开通</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          你已登录，但当前账号没有 MUHUB Admin 权限，暂时无法访问运营后台。
        </p>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          如需开通，请联系管理员并提供以下账号标识：
        </p>
        <div className="mt-2 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
          <p>userId: {userId}</p>
          <p>email: {userEmail}</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/dashboard" className="muhub-btn-secondary px-4 py-2 text-sm">
            返回控制台
          </Link>
          <Link href="/feedback" className="muhub-btn-primary px-4 py-2 text-sm">
            联系管理员开通
          </Link>
        </div>
      </div>
    </main>
  );
}
