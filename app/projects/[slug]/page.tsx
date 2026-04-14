import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ProjectDetailHero } from "@/components/project/project-detail-hero";
import { ProjectHeroPublicActions } from "@/components/project/project-hero-public-actions";
import { ProjectUpdates } from "@/components/project/project-updates";
import { ProjectDetailInfoSections } from "@/components/project/project-detail-info-sections";
import { loadProjectPageViewCached, sortProjectSocials } from "@/lib/load-project-page-view";
import { buildProjectMetaDescription } from "@/lib/seo/project-meta";
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
import { readProjectActivities } from "@/agents/activity/project-activity-store";
import { ProjectActivitySection } from "@/components/project/project-activity";
import ProjectSummary from "@/components/project/project-summary";
import { buildProjectHighlights } from "@/lib/project/project-highlights";
import { buildProjectSummary } from "@/lib/project/project-summary";
import { buildProjectPromoText } from "@/lib/project/project-promo-text";

export const dynamic = "force-dynamic";

function buildShareProjectInput(data: {
  description: string;
  tagline?: string;
  tags?: string[];
  githubUrl?: string;
  githubSnapshot?: { stars?: number | null; lastCommitAt?: Date | null } | null;
}) {
  return {
    description: data.description,
    stars: data.githubSnapshot?.stars ?? 0,
    lastCommitAt: data.githubSnapshot?.lastCommitAt ?? null,
    topics: (data.tags ?? []).map((x) => x.toLowerCase()),
    openSource: Boolean(data.githubUrl),
    tagline: data.tagline?.trim() || "",
  };
}

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
  const shareInput = buildShareProjectInput(data);
  const summary = buildProjectSummary(shareInput);
  const description =
    summary?.trim() ||
    data.description.trim() ||
    data.tagline?.trim() ||
    buildProjectMetaDescription(data);
  const title = `${data.name} | MUHUB`;
  const url = `${SITE_URL}/projects/${slug}`;
  const ogImage = `${SITE_URL}/projects/${slug}/opengraph-image`;
  const base = {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${data.name} | MUHUB` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
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
  const posterIntro =
    data.tagline?.trim() ||
    (data.description.trim() ? data.description.trim().slice(0, 360) : "") ||
    shareSnippet;

  const { projectId, engagement } = await getProjectEngagementForSlug(slug, session?.user?.id);
  const relatedSiteContent = await readSiteContentForProjectSlug(slug);
  const timelineItems = buildProjectTimelineItems(slug, data.updates, relatedSiteContent);
  const projectActivities = (await readProjectActivities())
    .filter((row) => row.projectSlug === slug)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 5);
  const project = buildShareProjectInput(data);
  const highlights = buildProjectHighlights(project);
  const summary = buildProjectSummary(project);
  const promoText = buildProjectPromoText({
    name: data.name,
    summary,
    highlights,
    latestActivity: projectActivities?.[0] ?? null,
    projectUrl: `${SITE_URL}/projects/${slug}`,
  });
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
          summary={summary ?? undefined}
          highlights={highlights}
          stars={data.githubSnapshot?.stars ?? undefined}
          lastCommitAt={data.githubSnapshot?.lastCommitAt ?? null}
          contributors={data.githubSnapshot?.contributorsCount ?? undefined}
          latestActivity={
            projectActivities[0]
              ? {
                  title: projectActivities[0].title,
                  type: projectActivities[0].type,
                  occurredAt: projectActivities[0].occurredAt,
                }
              : null
          }
          createdAt={data.createdAt}
          actions={
            <ProjectHeroPublicActions
              slug={slug}
              name={data.name}
              tagline={data.tagline}
              shareSnippet={shareSnippet}
              canonicalUrl={canonicalProjectUrl}
              description={descriptionForShare}
              posterIntro={posterIntro}
              posterSummary={summary ?? undefined}
              posterHighlights={highlights}
              posterLatestActivity={projectActivities[0] ?? null}
              promoText={promoText}
              githubUrl={data.githubUrl}
              websiteUrl={data.websiteUrl}
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

        {session?.user?.id ? (
          <p className="-mt-2 mb-8 text-right text-xs text-zinc-500 dark:text-zinc-400">
            <Link href="/me/subscriptions" className="underline-offset-2 hover:underline">
              我的项目订阅
            </Link>
          </p>
        ) : null}

        <ProjectActivitySection activities={projectActivities} />

        <ProjectSummary summary={summary ?? undefined} />

        <ProjectDetailInfoSections
          data={data}
          socials={socials}
          sourceItems={sourceItems}
          descriptionBody={descriptionBody}
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
      </div>
    </div>
  );
}
