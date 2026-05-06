import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ProjectDetailHero } from "@/components/project/project-detail-hero";
import { ProjectHeroPublicActions } from "@/components/project/project-hero-public-actions";
import { ProjectUpdates } from "@/components/project/project-updates";
import { ProjectDetailInfoSections } from "@/components/project/project-detail-info-sections";
import { ProjectReferenceSources } from "@/components/project/project-reference-sources";
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
import { readProjectPublicActivities } from "@/lib/activity/project-activity-service";
import { ProjectActivitySection } from "@/components/project/project-activity";
import { buildProjectHighlights } from "@/lib/project/project-highlights";
import { buildProjectSummary } from "@/lib/project/project-summary";
import { ProjectOfficialInfoEditor } from "@/components/project/project-official-info-editor";
import { ProjectAiContentDraft } from "@/components/project/project-ai-content-draft";
import { userOperatorLabel } from "@/lib/project-ai-content-edit-summary";

export const dynamic = "force-dynamic";

function getPublicProjectDetailText(project: {
  description?: string | null;
  simpleSummary?: string | null;
  tagline?: string | null;
}): string {
  const description = project.description?.trim();
  if (description) return description;
  const simpleSummary = project.simpleSummary?.trim();
  if (simpleSummary && simpleSummary !== project.tagline?.trim()) return simpleSummary;
  return "";
}

function buildShareProjectInput(data: {
  description: string;
  tagline?: string;
  simpleSummary?: string;
  tags?: string[];
  githubUrl?: string;
  githubSnapshot?: { stars?: number | null; lastCommitAt?: Date | null } | null;
}) {
  return {
    description: data.simpleSummary?.trim() || data.description,
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
  let projectIdForOfficial = "";
  let isClaimedOwner = false;
  let officialInfo: {
    summary: string | null;
    fullDescription: string | null;
    useCases: string[];
    whoFor: string[];
    website: string | null;
    twitter: string | null;
    discord: string | null;
    contactEmail: string | null;
  } | null = null;
  let aiContentStatus = "";
  let aiContentUpdatedAt = "";
  let aiContentError = "";
  let aiContent: unknown = null;
  let aiContentDraft: unknown = null;
  let aiContentDraftUpdatedAt = "";
  let aiContentDraftWorkflowStatus = "";
  let aiContentDraftWorkflowStatusUpdatedAt = "";
  let aiContentDraftOperatorLabel = "";
  if (fromDb && process.env.DATABASE_URL?.trim()) {
    const owners = await prisma.project.findFirst({
      where: { slug, ...PROJECT_ACTIVE_FILTER },
      select: {
        id: true,
        createdById: true,
        claimedByUserId: true,
        aiContent: true,
        aiContentStatus: true,
        aiContentUpdatedAt: true,
        aiContentError: true,
        aiContentDraft: true,
        aiContentDraftUpdatedAt: true,
        aiContentDraftBy: true,
        aiContentDraftStatus: true,
        aiContentDraftStatusUpdatedAt: true,
        officialInfo: {
          select: {
            summary: true,
            fullDescription: true,
            useCases: true,
            whoFor: true,
            website: true,
            twitter: true,
            discord: true,
            contactEmail: true,
          },
        },
      },
    });
    if (owners) {
      projectIdForOfficial = owners.id;
      showManageLink = canManageProject(session?.user?.id, owners);
      isClaimedOwner = Boolean(session?.user?.id && owners.claimedByUserId === session.user.id);
      aiContent = owners.aiContent;
      aiContentStatus = owners.aiContentStatus ?? "idle";
      aiContentUpdatedAt = owners.aiContentUpdatedAt?.toISOString() ?? "";
      aiContentError = owners.aiContentError ?? "";
      aiContentDraft = owners.aiContentDraft;
      aiContentDraftUpdatedAt = owners.aiContentDraftUpdatedAt?.toISOString() ?? "";
      aiContentDraftWorkflowStatus = owners.aiContentDraftStatus ?? "";
      aiContentDraftWorkflowStatusUpdatedAt = owners.aiContentDraftStatusUpdatedAt?.toISOString() ?? "";
      if (owners.aiContentDraftBy) {
        const draftUser = await prisma.user.findFirst({
          where: { id: owners.aiContentDraftBy },
          select: { name: true, email: true },
        });
        aiContentDraftOperatorLabel = userOperatorLabel(draftUser, owners.aiContentDraftBy);
      }
      officialInfo = owners.officialInfo
        ? {
            summary: owners.officialInfo.summary,
            fullDescription: owners.officialInfo.fullDescription,
            useCases: Array.isArray(owners.officialInfo.useCases)
              ? owners.officialInfo.useCases.filter((item): item is string => typeof item === "string")
              : [],
            whoFor: Array.isArray(owners.officialInfo.whoFor)
              ? owners.officialInfo.whoFor.filter((item): item is string => typeof item === "string")
              : [],
            website: owners.officialInfo.website,
            twitter: owners.officialInfo.twitter,
            discord: owners.officialInfo.discord,
            contactEmail: owners.officialInfo.contactEmail,
          }
        : null;
    }
  }

  const socials = sortProjectSocials(data.socials);

  const sourceItems = getProjectSources({
    legacyGithubUrl: data.githubUrl,
    legacyWebsiteUrl: data.websiteUrl,
    rows: (data.sources ?? []).map((s) => ({
      id: s.id,
      kind: s.kind,
      url: s.url,
      label: s.label ?? null,
      title: s.title ?? null,
      content: null,
      summary: s.summary ?? null,
      isPrimary: Boolean(s.isPrimary),
    })),
  });
  const gitccUrl =
    sourceItems.find((item) => item.categoryLabel === "GitCC" || item.url.includes("gitcc.com"))?.url ??
    null;

  const canonicalProjectUrl = projectCanonicalUrl(slug);
  const shareSnippet = buildProjectShareSnippet(data);
  const descriptionForShare = data.description.trim() || undefined;
  const posterIntro =
    data.tagline?.trim() ||
    (data.description.trim() ? data.description.trim().slice(0, 360) : "") ||
    shareSnippet;

  const { projectId, engagement } = await getProjectEngagementForSlug(slug, session?.user?.id);
  const relatedSiteContent = await readSiteContentForProjectSlug(slug);
  const projectActivities = await readProjectPublicActivities(slug, 5);
  const project = buildShareProjectInput(data);
  const highlights = buildProjectHighlights(project);
  const summary = buildProjectSummary(project);
  const officialSummary = officialInfo?.summary?.trim() || null;
  const heroSummary =
    officialSummary ||
    data.tagline?.trim() ||
    summary ||
    undefined;
  const heroSummaryWithSimple = officialSummary || heroSummary;

  const publicDetailText = getPublicProjectDetailText(data);
  const claimHref = `/projects/${encodeURIComponent(slug)}/claim`;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <ProjectJsonLd data={data} slug={slug} />
      <div className="mx-auto max-w-5xl px-6 py-10 md:py-12">
        <ProjectDetailHero
          slug={slug}
          name={data.name}
          tagline={data.tagline}
          summary={heroSummaryWithSimple}
          highlights={highlights}
          stars={data.githubSnapshot?.stars ?? undefined}
          lastCommitAt={data.githubSnapshot?.lastCommitAt ?? null}
          contributors={data.githubSnapshot?.contributorsCount ?? undefined}
          createdAt={data.createdAt}
          actions={
            <ProjectHeroPublicActions
              slug={slug}
              name={data.name}
              tagline={data.tagline}
              shareSnippet={shareSnippet}
              canonicalUrl={canonicalProjectUrl}
              description={descriptionForShare}
              tags={data.tags}
              category={data.primaryCategory}
              posterIntro={posterIntro}
              posterSummary={summary ?? undefined}
              posterHighlights={highlights}
              posterLatestActivity={projectActivities[0] ?? null}
              githubUrl={data.githubUrl}
              gitccUrl={gitccUrl}
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

        <ProjectActivitySection activities={projectActivities} />

        {publicDetailText ? (
          <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">项目详情</h2>
            <p className="mt-3 whitespace-pre-wrap leading-relaxed text-zinc-700 dark:text-zinc-300">{publicDetailText}</p>
          </section>
        ) : null}

        <ProjectDetailInfoSections
          data={data}
          socials={socials}
          sourceItems={sourceItems}
          descriptionBody={null}
        />

        <ProjectReferenceSources sources={data.referenceSources} />

        {projectActivities.length === 0 ? (
          <ProjectUpdates
            slug={slug}
            updates={data.updates}
            fromDb={fromDb}
            canManage={false}
            presentation="public"
          />
        ) : null}

        <ProjectRelatedContent items={relatedSiteContent} />

        {isClaimedOwner && projectIdForOfficial ? (
          <div className="mt-8">
            <ProjectOfficialInfoEditor
              projectId={projectIdForOfficial}
              initial={{
                summary: officialInfo?.summary ?? "",
                fullDescription: officialInfo?.fullDescription ?? "",
                website: officialInfo?.website ?? "",
                twitter: officialInfo?.twitter ?? "",
                discord: officialInfo?.discord ?? "",
                contactEmail: officialInfo?.contactEmail ?? "",
                useCases: officialInfo?.useCases ?? [],
                whoFor: officialInfo?.whoFor ?? [],
              }}
            />
          </div>
        ) : null}
        {isClaimedOwner && projectIdForOfficial ? (
          <div className="mt-8">
            <ProjectAiContentDraft
              projectId={projectIdForOfficial}
              initialStatus={aiContentStatus}
              initialUpdatedAt={aiContentUpdatedAt}
              initialContent={aiContent}
              initialError={aiContentError}
              initialDraft={aiContentDraft}
              initialDraftUpdatedAt={aiContentDraftUpdatedAt}
              initialDraftOperatorLabel={aiContentDraftOperatorLabel}
              initialDraftWorkflowStatus={aiContentDraftWorkflowStatus}
              initialDraftWorkflowStatusUpdatedAt={aiContentDraftWorkflowStatusUpdatedAt}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
