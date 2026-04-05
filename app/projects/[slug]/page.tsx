import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ProjectDetailHero } from "@/components/project/project-detail-hero";
import { ProjectHeroPublicActions } from "@/components/project/project-hero-public-actions";
import { ProjectUpdates } from "@/components/project/project-updates";
import { ProjectDetailInfoSections } from "@/components/project/project-detail-info-sections";
import { loadProjectPageViewCached, sortProjectSocials } from "@/lib/load-project-page-view";
import {
  buildProjectMetaDescription,
  buildProjectOpenGraph,
  buildProjectTwitter,
} from "@/lib/seo/project-meta";
import { SITE_URL } from "@/lib/seo/site";
import { getProjectSources } from "@/lib/project-sources";
import { ProjectJsonLd } from "@/components/project/project-json-ld";
import { buildProjectShareSnippet, projectCanonicalUrl } from "@/lib/share/project-share";
import { normalizeProjectSlugParam } from "@/lib/route-slug";
import { getProjectEngagementForSlug } from "@/lib/project-engagement";
import { canManageProject } from "@/lib/project-permissions";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";
import { readSiteContentForProjectSlug } from "@/agents/growth/site-content-store";
import { ProjectRelatedContent } from "@/components/content/project-related-content";
import { ProjectTimeline } from "@/components/content/project-timeline";
import { buildProjectTimelineItems } from "@/lib/content/project-timeline";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const slug = normalizeProjectSlugParam((await params).slug);
  const session = await auth();
  const loaded = await loadProjectPageViewCached(slug, session?.user?.id);
  if (!loaded) {
    return { title: "项目" };
  }
  const { data, access } = loaded;
  const base = {
    title: data.name,
    description: buildProjectMetaDescription(data),
    alternates: {
      canonical: `${SITE_URL}/projects/${slug}`,
    },
    openGraph: buildProjectOpenGraph(data, slug),
    twitter: buildProjectTwitter(data),
  };
  if (access === "manager_preview") {
    return { ...base, robots: { index: false, follow: false } };
  }
  return base;
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = normalizeProjectSlugParam((await params).slug);
  const session = await auth();
  const loaded = await loadProjectPageViewCached(slug, session?.user?.id);
  if (!loaded) {
    notFound();
  }

  const { data, fromDb } = loaded;
  let showManageLink = false;
  if (fromDb && process.env.DATABASE_URL?.trim()) {
    const owners = await prisma.project.findFirst({
      where: { slug, ...PROJECT_ACTIVE_FILTER },
      select: { createdById: true, claimedByUserId: true },
    });
    if (owners) {
      showManageLink = canManageProject(session?.user?.id, owners);
    }
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

  const { projectId, engagement } = await getProjectEngagementForSlug(slug, session?.user?.id);
  const relatedSiteContent = await readSiteContentForProjectSlug(slug);
  const timelineItems = buildProjectTimelineItems(slug, data.updates, relatedSiteContent);
  const claimHref =
    fromDb && process.env.DATABASE_URL?.trim() && !showManageLink
      ? `/projects/${encodeURIComponent(slug)}/claim`
      : undefined;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <ProjectJsonLd data={data} slug={slug} />
      <div className="mx-auto max-w-5xl px-6 py-10 md:py-12">
        <ProjectDetailHero
          slug={slug}
          name={data.name}
          tagline={data.tagline}
          createdAt={data.createdAt}
          actions={
            <ProjectHeroPublicActions
              slug={slug}
              name={data.name}
              tagline={data.tagline}
              shareSnippet={shareSnippet}
              canonicalUrl={canonicalProjectUrl}
              description={descriptionForShare}
              showManageLink={showManageLink}
              claimHref={claimHref}
              engagement={{
                projectId,
                interactive: fromDb && Boolean(projectId),
                viewerLoggedIn: Boolean(session?.user?.id),
                initial: engagement,
                signInCallbackPath: `/projects/${slug}`,
              }}
            />
          }
        />

        <ProjectUpdates
          slug={slug}
          updates={data.updates}
          fromDb={fromDb}
          canManage={false}
          presentation="public"
        />

        <ProjectTimeline items={timelineItems} />

        <ProjectRelatedContent items={relatedSiteContent} />

        <ProjectDetailInfoSections
          data={data}
          socials={socials}
          sourceItems={sourceItems}
          descriptionBody={descriptionBody}
        />
      </div>
    </div>
  );
}
