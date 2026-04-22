import { prisma } from "@/lib/prisma";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";

export type AdminMarketingProjectSnippet = {
  id: string;
  slug: string;
  name: string;
  status: string;
  visibilityStatus: string;
  tagline: string | null;
  simpleSummary: string | null;
  primaryCategory: string | null;
  tags: string[];
  websiteUrl: string | null;
  githubUrl: string | null;
  referenceSources: unknown;
};

export async function fetchMarketingProjectSnippet(
  projectId: string | undefined,
): Promise<AdminMarketingProjectSnippet | null> {
  const id = projectId?.trim();
  if (!id) {
    return null;
  }
  return prisma.project.findFirst({
    where: { id, ...PROJECT_ACTIVE_FILTER },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      visibilityStatus: true,
      tagline: true,
      simpleSummary: true,
      primaryCategory: true,
      tags: true,
      websiteUrl: true,
      githubUrl: true,
      referenceSources: true,
    },
  });
}
