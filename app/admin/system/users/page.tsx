import Link from "next/link";
import { isMuHubAdminUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminSystemUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      sessions: {
        orderBy: { expires: "desc" },
        take: 1,
        select: { expires: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/system" className="underline">
          ← 系统首页
        </Link>
      </p>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          用户管理
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          最小用户列表，只读展示，不提供编辑/删除操作。
        </p>
      </header>

      <form method="get" className="flex max-w-lg gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="搜索 name / email"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
        >
          搜索
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">用户 ID</th>
              <th className="px-3 py-2">名称</th>
              <th className="px-3 py-2">邮箱</th>
              <th className="px-3 py-2">注册时间</th>
              <th className="px-3 py-2">管理员</th>
              <th className="px-3 py-2">最近会话</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  没有匹配用户。
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const latestSessionExpiry = user.sessions[0]?.expires ?? null;
                const isAdmin = isMuHubAdminUser({
                  id: user.id,
                  email: user.email,
                  role: null,
                });
                return (
                  <tr key={user.id} className="border-t border-zinc-100 dark:border-zinc-800/80">
                    <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                      {user.id}
                    </td>
                    <td className="px-3 py-2">{user.name || "—"}</td>
                    <td className="px-3 py-2">{user.email || "—"}</td>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {user.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                          isAdmin
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                            : "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
                        }`}
                      >
                        {isAdmin ? "是" : "否"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {latestSessionExpiry
                        ? `expires: ${latestSessionExpiry.toISOString().replace("T", " ").slice(0, 19)}`
                        : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
