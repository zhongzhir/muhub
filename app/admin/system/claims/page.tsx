import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { updateProjectClaimStatus } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = ["PENDING", "REVIEWING", "APPROVED", "REJECTED"] as const;

type PageProps = {
  searchParams?: Promise<{ status?: string }>;
};

function statusHref(status?: string) {
  return status ? `/admin/system/claims?status=${encodeURIComponent(status)}` : "/admin/system/claims";
}

function truncate(value: string | null | undefined, max = 120): string {
  const text = value?.trim();
  if (!text) return "-";
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function contactText(row: {
  contactEmail: string | null;
  contactWechat: string | null;
  contactPhone: string | null;
  userEmail: string | null;
}) {
  return [
    row.contactEmail || row.userEmail ? `邮箱：${row.contactEmail || row.userEmail}` : "",
    row.contactWechat ? `微信：${row.contactWechat}` : "",
    row.contactPhone ? `手机：${row.contactPhone}` : "",
  ].filter(Boolean);
}

export default async function AdminProjectClaimsPage({ searchParams }: PageProps) {
  const statusParam = (await searchParams)?.status?.trim().toUpperCase() ?? "";
  const status = STATUS_OPTIONS.includes(statusParam as (typeof STATUS_OPTIONS)[number]) ? statusParam : "";

  const rows = await prisma.projectClaim.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      projectId: true,
      projectSlug: true,
      projectName: true,
      claimantName: true,
      claimantRole: true,
      organizationName: true,
      contactEmail: true,
      contactWechat: true,
      contactPhone: true,
      proofUrl: true,
      message: true,
      status: true,
      userEmail: true,
      reason: true,
      createdAt: true,
      project: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-zinc-500">
          <Link href="/admin/system" className="underline-offset-4 hover:underline">
            系统后台
          </Link>
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">项目认领</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              查看公开项目页提交的认领申请。状态修改仅更新申请记录，不会自动修改项目认领状态。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link className={`muhub-btn-secondary px-3 py-2 ${!status ? "border-zinc-900 dark:border-zinc-100" : ""}`} href={statusHref()}>
              全部
            </Link>
            {STATUS_OPTIONS.map((item) => (
              <Link
                key={item}
                className={`muhub-btn-secondary px-3 py-2 ${status === item ? "border-zinc-900 dark:border-zinc-100" : ""}`}
                href={statusHref(item)}
              >
                {item}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <section className="muhub-card overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">暂无认领申请。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">提交时间</th>
                  <th className="px-4 py-3">项目</th>
                  <th className="px-4 py-3">申请人</th>
                  <th className="px-4 py-3">关系</th>
                  <th className="px-4 py-3">机构</th>
                  <th className="px-4 py-3">联系方式</th>
                  <th className="px-4 py-3">证明链接</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">补充说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rows.map((row) => {
                  const projectSlug = row.projectSlug || row.project.slug;
                  const contacts = contactText(row);
                  return (
                    <tr key={row.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-4 text-zinc-500">
                        {row.createdAt.toLocaleString("zh-CN")}
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/admin/projects/${encodeURIComponent(row.projectId)}/edit`}
                          className="font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
                        >
                          {row.projectName || row.project.name}
                        </Link>
                        <div className="mt-1">
                          <Link
                            href={`/projects/${encodeURIComponent(projectSlug)}`}
                            className="text-xs text-zinc-500 underline-offset-4 hover:underline"
                          >
                            /projects/{projectSlug}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-4">{row.claimantName || "-"}</td>
                      <td className="px-4 py-4">{row.claimantRole || "-"}</td>
                      <td className="px-4 py-4">{row.organizationName || "-"}</td>
                      <td className="px-4 py-4">
                        {contacts.length > 0 ? (
                          <ul className="space-y-1">
                            {contacts.map((item) => (
                              <li key={item} className="break-all">{item}</li>
                            ))}
                          </ul>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {row.proofUrl ? (
                          <a href={row.proofUrl} target="_blank" rel="noopener noreferrer" className="break-all text-blue-600 underline-offset-4 hover:underline dark:text-blue-400">
                            查看证明
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <form action={updateProjectClaimStatus} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={row.id} />
                          <select name="status" defaultValue={row.status} className="muhub-input min-w-32 py-1.5 text-xs">
                            {STATUS_OPTIONS.map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                          <button type="submit" className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                            更新
                          </button>
                        </form>
                      </td>
                      <td className="max-w-xs px-4 py-4 text-zinc-600 dark:text-zinc-300">
                        {truncate(row.message || row.reason)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
