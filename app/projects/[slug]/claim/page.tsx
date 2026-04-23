import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { userHasGitHubAccount } from "@/lib/auth/user-has-github";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";
import { normalizeProjectSlugParam } from "@/lib/route-slug";
import { ClaimProjectForm } from "./claim-project-form";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ submitted?: string }>;
};

export default async function ClaimProjectPage({ params, searchParams }: PageProps) {
  const slug = normalizeProjectSlugParam((await params).slug);
  const submitted = (await searchParams)?.submitted === "1";

  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-lg rounded-lg border border-amber-200 bg-amber-50 px-6 py-8 text-sm dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">无法认领</p>
          <p className="mt-2">请配置 <strong>DATABASE_URL</strong> 后重试。</p>
          <p className="mt-4">
            <Link href="/" className="underline underline-offset-4">
              返回首页
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const project = await prisma.project.findFirst({
    where: { slug, ...PROJECT_ACTIVE_FILTER },
    select: {
      id: true,
      slug: true,
      name: true,
      githubUrl: true,
      claimStatus: true,
    },
  });

  if (!project) {
    notFound();
  }

  if (!project.githubUrl?.trim()) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-xl">
          <h1 className="text-2xl font-semibold tracking-tight">认领项目</h1>
          <p className="mt-4 text-sm text-red-700 dark:text-red-300">
            该项目未绑定代码仓库地址，无法通过仓库认领。请先编辑项目补充 GitHub / Gitee URL。
          </p>
          <p className="mt-6 flex flex-wrap gap-4 text-sm">
            <Link href={`/projects/${encodeURIComponent(slug)}`} className="underline underline-offset-4">
              返回项目页
            </Link>
            <Link
              href={`/dashboard/projects/${encodeURIComponent(slug)}/edit`}
              className="underline underline-offset-4"
            >
              编辑项目
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const latestClaim = await prisma.projectClaim.findFirst({
    where: { projectId: project.id, status: "pending" },
    orderBy: { createdAt: "desc" },
    select: { id: true, userId: true, createdAt: true },
  });

  if (project.claimStatus === "CLAIMED") {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-xl">
          <h1 className="text-2xl font-semibold tracking-tight">认领项目</h1>
          <p
            role="alert"
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
          >
            该项目已被认领
          </p>
          <p className="mt-6">
            <Link href={`/projects/${encodeURIComponent(slug)}`} className="text-sm underline underline-offset-4">
              返回项目页
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const session = await auth();
  const githubLinked = session?.user?.id ? await userHasGitHubAccount(session.user.id) : false;
  const githubClaimBlocked = Boolean(session?.user?.id) && !githubLinked;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-xl px-6 py-12">
        <p className="mb-6 flex flex-wrap gap-4 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
          <Link href={`/projects/${encodeURIComponent(slug)}`} className="underline-offset-4 hover:underline">
            返回项目页
          </Link>
        </p>
        <h1 className="mb-8 text-2xl font-semibold tracking-tight">认领项目</h1>
        {submitted ? (
          <p className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            认领申请已提交，等待管理员审核。
          </p>
        ) : null}
        {latestClaim ? (
          <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
            当前项目已有待审核认领请求，提交后将进入审核队列。
          </p>
        ) : null}

        {githubClaimBlocked ? (
          <p
            role="status"
            className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
          >
            认领 GitHub 公开仓库项目前，请先使用 GitHub 登录或绑定 GitHub
            账号。手机号登录可用于创建与管理项目；绑定功能即将开放。
          </p>
        ) : null}

        <ClaimProjectForm
          slug={slug}
          projectName={project.name}
          hintGithubUrl={project.githubUrl}
          githubClaimBlocked={githubClaimBlocked}
        />
      </div>
    </div>
  );
}
