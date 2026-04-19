import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getMuHubAdminDebugInfo, isMuHubAdminUser } from "@/lib/admin-auth";

function NavGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-[10rem] flex-col gap-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{title}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">{children}</div>
    </div>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const callback = "/admin/projects";
  const user = {
    id: session?.user?.id,
    email: session?.user?.email,
    role: (session?.user as { role?: string | null } | undefined)?.role ?? null,
  };

  if (!user.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callback)}`);
  }
  if (!isMuHubAdminUser(user)) {
    const debug = getMuHubAdminDebugInfo(user);
    console.warn("[admin-layout] forbidden", debug);
    redirect("/admin-forbidden");
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/admin"
              className="text-sm font-semibold tracking-tight text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
            >
              MUHUB Admin
            </Link>
            <Link
              href="/dashboard"
              className="text-xs text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-500"
            >
              用户控制台
            </Link>
          </div>
          <nav className="flex flex-wrap gap-6 border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
            <NavGroup title="项目筛选">
              <Link
                href="/admin/discovery"
                className="text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                候选列表
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
                来源管理
              </Link>
              <Link
                href="/admin/discovery/tasks"
                className="text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                抓取与任务
              </Link>
            </NavGroup>
            <NavGroup title="项目管理">
              <Link
                href="/admin/projects"
                className="text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                项目列表
              </Link>
              <Link
                href="/admin/projects/quality"
                className="text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                质量看板
              </Link>
            </NavGroup>
            <NavGroup title="项目营销">
              <Link
                href="/admin/marketing"
                className="text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                营销中心
              </Link>
              <Link
                href="/admin/marketing/posters"
                className="text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                海报
              </Link>
              <Link
                href="/admin/marketing/copy"
                className="text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                文案
              </Link>
              <Link
                href="/admin/marketing/campaigns"
                className="text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                活动
              </Link>
            </NavGroup>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
