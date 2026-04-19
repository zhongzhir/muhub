import { prisma } from "@/lib/prisma";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";

export type AdminMarketingProjectSnippet = {
  id: string;
  slug: string;
  name: string;
  status: string;
  visibilityStatus: string;
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
    },
  });
}
