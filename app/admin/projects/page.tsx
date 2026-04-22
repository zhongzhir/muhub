import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import type { Prisma, ProjectStatus, ProjectVisibilityStatus } from "@prisma/client";
import { ProjectsAdminTable } from "./projects-admin-table";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const STATUS_OPTIONS: ProjectStatus[] = ["DRAFT", "READY", "PUBLISHED", "ARCHIVED"];
const VISIBILITY_OPTIONS: ProjectVisibilityStatus[] = ["DRAFT", "PUBLISHED", "HIDDEN"];

function qp(sp: SearchParams, key: string): string {
  const value = sp[key];
  if (Array.isArray(value)) {
    return (value[0] ?? "").trim();
  }
  return (value ?? "").trim();
}

export default async function AdminProjectsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
        未配置 DATABASE_URL，无法加载项目列表。
      </div>
    );
  }

  const sp = await searchParams;
  const status = qp(sp, "status");
  const visibility = qp(sp, "visibility");
  const keyword = qp(sp, "keyword");
  const where: Prisma.ProjectWhereInput = {
    ...PROJECT_ACTIVE_FILTER,
    ...(status && STATUS_OPTIONS.includes(status as ProjectStatus)
      ? { status: status as ProjectStatus }
      : {}),
    ...(visibility && VISIBILITY_OPTIONS.includes(visibility as ProjectVisibilityStatus)
      ? { visibilityStatus: visibility as ProjectVisibilityStatus }
      : {}),
    ...(keyword
      ? {
          OR: [
            { name: { contains: keyword, mode: "insensitive" } },
            { slug: { contains: keyword, mode: "insensitive" } },
            { tagline: { contains: keyword, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await prisma.project.findMany({
    where,
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      status: true,
      visibilityStatus: true,
      primaryCategory: true,
      tags: true,
      isPublic: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">
            <Link href="/admin" className="underline-offset-4 hover:underline">
              ← 后台总览
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">项目列表</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">正式项目维护入口；收录自 Discovery 后在此编辑与发布。</p>
        </div>
        <Link href="/admin/projects/quality" className="muhub-btn-secondary px-3 py-2 text-sm">
          质量看板
        </Link>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <form className="grid gap-3 md:grid-cols-4">
          <label className="text-sm text-zinc-600 dark:text-zinc-300">
            状态
            <select name="status" defaultValue={status} className="muhub-input mt-1">
              <option value="">全部</option>
              {STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-zinc-600 dark:text-zinc-300">
            可见性
            <select name="visibility" defaultValue={visibility} className="muhub-input mt-1">
              <option value="">全部</option>
              {VISIBILITY_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-zinc-600 dark:text-zinc-300 md:col-span-2">
            关键词（name / slug / tagline）
            <input
              name="keyword"
              defaultValue={keyword}
              placeholder="例如：agent / muhub / 一句话简介"
              className="muhub-input mt-1"
            />
          </label>
          <div className="flex flex-wrap gap-2 md:col-span-4">
            <button type="submit" className="muhub-btn-primary px-3 py-2 text-sm">
              筛选
            </button>
            <Link href="/admin/projects" className="muhub-btn-secondary px-3 py-2 text-sm">
              重置
            </Link>
          </div>
        </form>
      </section>

      <ProjectsAdminTable
        rows={rows.map((r) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          tagline: r.tagline,
          status: r.status,
          visibilityStatus: r.visibilityStatus,
          primaryCategory: r.primaryCategory,
          tags: r.tags,
          isPublic: r.isPublic,
          updatedAtText: r.updatedAt.toISOString().replace("T", " ").slice(0, 19),
        }))}
      />
    </div>
  );
}
