import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isMuHubAdminUserId } from "@/lib/admin-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/admin/discovery");
  }
  if (!isMuHubAdminUserId(session.user.id)) {
    redirect("/dashboard?error=admin_forbidden");
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold tracking-tight">MUHUB Admin</span>
            <Link
              href="/admin/discovery"
              className="text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Discovery 候选
            </Link>
            <Link
              href="/admin/discovery/items"
              className="text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              JSON 队列
            </Link>
            <Link
              href="/admin/discovery/sources"
              className="text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Sources
            </Link>
            <Link
              href="/admin/projects/quality"
              className="text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              项目质量
            </Link>
            <Link
              href="/dashboard"
              className="text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-500"
            >
              控制台
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
