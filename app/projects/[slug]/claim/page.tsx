import Link from "next/link";
import { notFound } from "next/navigation";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";
import { normalizeProjectSlugParam } from "@/lib/route-slug";
import { ClaimProjectForm } from "./claim-project-form";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ClaimProjectPage({ params }: PageProps) {
  const slug = normalizeProjectSlugParam((await params).slug);

  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-lg rounded-lg border border-amber-200 bg-amber-50 px-6 py-8 text-sm dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">无法提交认领申请</p>
          <p className="mt-2">请配置数据库后重试。</p>
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
      tagline: true,
      simpleSummary: true,
      description: true,
    },
  });

  if (!project) {
    notFound();
  }

  const summary =
    project.tagline?.trim() ||
    project.simpleSummary?.trim() ||
    project.description?.trim().slice(0, 180) ||
    "MUHUB 项目库收录项目。";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <main className="mx-auto max-w-3xl px-6 py-10 md:py-14">
        <p className="mb-6">
          <Link
            href={`/projects/${encodeURIComponent(project.slug)}`}
            className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            返回项目页
          </Link>
        </p>

        <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">项目认领</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            认领项目
          </h1>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {project.name}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{summary}</p>
          <p className="mt-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            认领项目后，你可以向 MUHUB 提交项目方身份信息。审核通过后，项目方可补充官方信息、运营数据和项目动态。
          </p>
        </section>

        <ClaimProjectForm slug={project.slug} />

        <p className="mt-5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          提交的信息仅用于 MUHUB 核验项目方身份，不会在未经确认前公开展示。
        </p>
      </main>
    </div>
  );
}
