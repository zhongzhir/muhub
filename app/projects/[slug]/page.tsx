import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectDetailHero } from "@/components/project/project-detail-hero";
import { ProjectPublicShareBar } from "@/components/project/project-public-share-bar";
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
import {
  buildProjectShareClipboardText,
  buildProjectShareSnippet,
  projectCanonicalUrl,
} from "@/lib/share/project-share";
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
    return { title: "项目" };
  }
  const { data } = loaded;
  return {
    title: data.name,
    description: buildProjectMetaDescription(data),
    alternates: {
      canonical: `${SITE_URL}/projects/${slug}`,
    },
    openGraph: buildProjectOpenGraph(data, slug),
    twitter: buildProjectTwitter(data),
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = normalizeProjectSlugParam((await params).slug);
  const loaded = await loadProjectPageViewCached(slug);
  if (!loaded) {
    notFound();
  }

  const { data, fromDb } = loaded;
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

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <ProjectJsonLd data={data} slug={slug} />
      <div className="mx-auto max-w-5xl px-6 py-10 md:py-12">
        <ProjectDetailHero
          slug={slug}
          name={data.name}
          tagline={data.tagline}
          createdAt={data.createdAt}
        />

        <ProjectPublicShareBar
          name={data.name}
          tagline={data.tagline}
          shareSnippet={buildProjectShareSnippet(data)}
          canonicalUrl={canonicalProjectUrl}
          shareClipboardText={buildProjectShareClipboardText(data, slug)}
        />

        <ProjectUpdates slug={slug} updates={data.updates} fromDb={fromDb} canManage={false} />

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
