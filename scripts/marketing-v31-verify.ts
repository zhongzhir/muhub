import { PrismaClient } from "@prisma/client";
import { generateMarketingContent } from "../lib/ai/marketing/marketing-generator";

const prisma = new PrismaClient();

type PickedProject = {
  id: string;
  name: string;
  slug: string;
  primaryCategory: string | null;
  tags: string[];
  tagline: string | null;
  description: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  categoriesJson: unknown;
  aiInsight: unknown;
  officialInfo: {
    summary: string | null;
    fullDescription: string | null;
    useCases: unknown;
    whoFor: unknown;
  } | null;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function pickByKind(rows: PickedProject[]) {
  const tool = rows.find((r) =>
    ["developer-tools", "productivity", "infra"].includes((r.primaryCategory ?? "").toLowerCase()),
  );
  const desktop = rows.find((r) => {
    const text = `${r.name} ${(r.tags ?? []).join(" ")}`.toLowerCase();
    return text.includes("desktop") || text.includes("electron") || text.includes("app");
  });
  const content = rows.find((r) => {
    const text = `${r.name} ${(r.tags ?? []).join(" ")} ${r.primaryCategory ?? ""}`.toLowerCase();
    return text.includes("content") || text.includes("education") || text.includes("book") || text.includes("学习");
  });
  const picked = [tool, desktop, content].filter(Boolean) as PickedProject[];
  for (const row of rows) {
    if (picked.length >= 3) break;
    if (!picked.some((p) => p.id === row.id)) picked.push(row);
  }
  return picked.slice(0, 3);
}

async function main() {
  const rows = await prisma.project.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      primaryCategory: true,
      tags: true,
      tagline: true,
      description: true,
      githubUrl: true,
      websiteUrl: true,
      categoriesJson: true,
      aiInsight: true,
      officialInfo: {
        select: {
          summary: true,
          fullDescription: true,
          useCases: true,
          whoFor: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });

  const picked = pickByKind(rows as PickedProject[]);
  const outputs: Array<Record<string, unknown>> = [];
  for (const project of picked) {
    const sourceBasis = {
      hasOfficialInfo: Boolean(
        project.officialInfo?.summary ||
          project.officialInfo?.fullDescription ||
          asStringArray(project.officialInfo?.useCases).length ||
          asStringArray(project.officialInfo?.whoFor).length,
      ),
      hasAiInsight: Boolean(project.aiInsight && typeof project.aiInsight === "object"),
      usedFields: [
        project.tagline ? "project.tagline" : "",
        project.description ? "project.description" : "",
        project.tags.length ? "project.tags" : "",
        project.primaryCategory ? "project.primaryCategory" : "",
        project.githubUrl ? "project.githubUrl" : "",
        project.websiteUrl ? "project.websiteUrl" : "",
      ].filter(Boolean),
    };
    const input = {
      project: {
        name: project.name,
        tagline: project.tagline,
        description: project.description,
        tags: project.tags,
        categories: asStringArray(project.categoriesJson),
        primaryCategory: project.primaryCategory,
        githubUrl: project.githubUrl,
        websiteUrl: project.websiteUrl,
      },
      officialInfo: project.officialInfo
        ? {
            summary: project.officialInfo.summary,
            fullDescription: project.officialInfo.fullDescription,
            useCases: asStringArray(project.officialInfo.useCases),
            whoFor: asStringArray(project.officialInfo.whoFor),
          }
        : null,
      aiInsight: (project.aiInsight ?? null) as {
        summary?: string;
        whatItIs?: string;
        whoFor?: string[] | string;
        useCases?: string[] | string;
        highlights?: string[] | string;
        valueSignals?: string[] | string;
      } | null,
      sourceBasis,
    };
    const social = await generateMarketingContent({
      ...input,
      mode: "social",
      tone: "balanced",
    });
    const article = await generateMarketingContent({
      ...input,
      mode: "article",
      tone: "balanced",
    });
    outputs.push({
      project: { id: project.id, name: project.name, slug: project.slug, primaryCategory: project.primaryCategory },
      social: {
        hookLine: social.hookLine ?? "",
        content: social.content.slice(0, 200),
        notes: social.summaryNotes,
      },
      article: {
        titleCandidates: article.titleCandidates ?? [],
        contentPreview: article.content.slice(0, 400),
        notes: article.summaryNotes,
      },
    });
  }
  console.log(JSON.stringify(outputs, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
