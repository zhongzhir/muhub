import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ProjectDetailHero } from "@/components/project/project-detail-hero";
import { ProjectDetailInfoSections } from "@/components/project/project-detail-info-sections";
import { ProjectPublishedAck } from "@/components/project/project-published-ack";
import { ProjectUpdates } from "@/components/project/project-updates";
import { ProjectWorkspace } from "@/components/project/project-workspace";
import { RefreshGithubSnapshotForm } from "@/app/projects/[slug]/refresh-github-form";
import { loadProjectPageViewCached, sortProjectSocials } from "@/lib/load-project-page-view";
import { canManageProject } from "@/lib/project-permissions";
import { prisma } from "@/lib/prisma";
import { buildProjectShareSnippet, projectCanonicalUrl } from "@/lib/share/project-share";
import { getProjectSources } from "@/lib/project-sources";
import { normalizeProjectSlugParam } from "@/lib/route-slug";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const slug = normalizeProjectSlugParam((await params).slug);
  const loaded = await loadProjectPageViewCached(slug);
  if (!loaded) {
    return { title: "项目管理" };
  }
  return {
    title: `${loaded.data.name} · 管理`,
    robots: { index: false, follow: true },
  };
}

export default async function DashboardProjectManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ published?: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = normalizeProjectSlugParam(rawSlug);
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/dashboard/projects/${slug}`)}`);
  }
  const sp = await searchParams;
  const showPublishedAck = sp.published === "1";

  const loaded = await loadProjectPageViewCached(slug);
  if (!loaded) {
    notFound();
  }

  const { data, fromDb } = loaded;

  let canManage = false;
  if (fromDb && process.env.DATABASE_URL?.trim()) {
    const owners = await prisma.project.findUnique({
      where: { slug },
      select: { createdById: true, claimedByUserId: true },
    });
    if (owners) {
      canManage = canManageProject(session.user.id, owners);
    }
  }

  if (!canManage) {
    redirect(`/projects/${encodeURIComponent(slug)}`);
  }

  const socials = sortProjectSocials(data.socials);
  const hasDescription = Boolean(data.description.trim());
  const descriptionBody = hasDescription ? data.description.trim() : null;
  const sourceItems = getProjectSources({
    legacyGithubUrl: data.githubUrl,
    legacyWebsiteUrl: data.websiteUrl,
    rows: (data.sources ?? []).map((s) => ({
      id: s.id,
      kind: s.kind,
      url: s.url,
      label: s.label ?? null,
      isPrimary: Boolean(s.isPrimary),
    })),
  });

  const canonicalProjectUrl = projectCanonicalUrl(slug);
  const shareSnippet = buildProjectShareSnippet(data);
  const descriptionForShare = data.description.trim() || undefined;

  const githubRefreshSlot =
    fromDb && data.githubUrl?.trim() ? <RefreshGithubSnapshotForm slug={slug} /> : null;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-10 md:py-12">
        <p className="mb-6 text-sm text-zinc-500">
          <Link href="/dashboard" className="underline-offset-4 hover:underline">
            我的项目
          </Link>
          <span className="mx-2 text-zinc-300">·</span>
          <Link href={`/projects/${encodeURIComponent(slug)}`} className="underline-offset-4 hover:underline">
            查看公开页
          </Link>
        </p>

        <ProjectDetailHero slug={slug} name={data.name} tagline={data.tagline} createdAt={data.createdAt} />

        <ProjectPublishedAck show={showPublishedAck} />

        <ProjectWorkspace
          slug={slug}
          name={data.name}
          tagline={data.tagline}
          shareSnippet={shareSnippet}
          canonicalUrl={canonicalProjectUrl}
          description={descriptionForShare}
        />

        <ProjectUpdates
          slug={slug}
          updates={data.updates}
          fromDb={fromDb}
          canManage
          showHeaderPublishLink
        />

        <ProjectDetailInfoSections
          data={data}
          socials={socials}
          sourceItems={sourceItems}
          descriptionBody={descriptionBody}
          githubRefreshSlot={githubRefreshSlot}
        />
      </div>
    </div>
  );
}
