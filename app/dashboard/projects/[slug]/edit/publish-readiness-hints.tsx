import {
  completenessInputFromParts,
  computeProjectCompleteness,
  publishReadinessMessages,
} from "@/lib/project-completeness";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";

export async function PublishReadinessHints({ slug }: { slug: string }) {
  if (!process.env.DATABASE_URL?.trim()) {
    return null;
  }

  const row = await prisma.project.findFirst({
    where: { slug, ...PROJECT_ACTIVE_FILTER },
    select: {
      name: true,
      tagline: true,
      description: true,
      primaryCategory: true,
      tags: true,
      websiteUrl: true,
      githubUrl: true,
      sources: { select: { kind: true } },
      externalLinks: { select: { platform: true } },
    },
  });

  if (!row) {
    return null;
  }

  const comp = computeProjectCompleteness(
    completenessInputFromParts({
      name: row.name,
      tagline: row.tagline,
      description: row.description,
      primaryCategory: row.primaryCategory,
      tags: row.tags,
      websiteUrl: row.websiteUrl,
      githubUrl: row.githubUrl,
      sources: row.sources,
      externalLinks: row.externalLinks,
    }),
  );

  const msgs = publishReadinessMessages(comp);
  if (msgs.length === 0) {
    return null;
  }

  return (
    <div
      className="mb-6 rounded-xl border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100"
      role="status"
      data-testid="publish-readiness-hints"
    >
      <p className="font-medium">资料完整度提示（不阻止发布或隐藏）</p>
      <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs leading-relaxed opacity-95">
        {msgs.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
