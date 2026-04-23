import { NextRequest, NextResponse } from "next/server";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { generateMarketingContent } from "@/lib/ai/marketing/marketing-generator";

export const dynamic = "force-dynamic";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireMuHubAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.code === "UNAUTHORIZED" ? 401 : 403 },
      );
    }
    throw error;
  }

  try {
    const { mode, tone } = (await req.json().catch(() => ({}))) as {
      mode?: "social" | "article";
      tone?: "balanced" | "expressive";
    };
    const { id } = await ctx.params;
    const contentMode = mode === "article" ? "article" : "social";
    const contentTone = tone === "expressive" ? "expressive" : "balanced";

    const project = await prisma.project.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        tagline: true,
        description: true,
        tags: true,
        primaryCategory: true,
        categoriesJson: true,
        githubUrl: true,
        websiteUrl: true,
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
    });

    if (!project) {
      return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
    }

    const officialUseCases = asStringArray(project.officialInfo?.useCases);
    const officialWhoFor = asStringArray(project.officialInfo?.whoFor);
    const usedFields: string[] = [];
    const hasOfficialInfo = Boolean(
      project.officialInfo?.summary ||
      project.officialInfo?.fullDescription ||
      officialUseCases.length > 0 ||
      officialWhoFor.length > 0,
    );
    const hasAiInsight = Boolean(project.aiInsight && typeof project.aiInsight === "object");
    if (hasOfficialInfo) {
      usedFields.push("officialInfo.summary", "officialInfo.fullDescription", "officialInfo.useCases", "officialInfo.whoFor");
    }
    if (hasAiInsight) {
      usedFields.push("aiInsight.summary", "aiInsight.whatItIs", "aiInsight.whoFor", "aiInsight.useCases", "aiInsight.highlights", "aiInsight.valueSignals");
    }
    if (project.tagline) usedFields.push("project.tagline");
    if (project.description) usedFields.push("project.description");
    if (project.tags.length) usedFields.push("project.tags");
    if (project.primaryCategory) usedFields.push("project.primaryCategory");
    if (project.githubUrl) usedFields.push("project.githubUrl");
    if (project.websiteUrl) usedFields.push("project.websiteUrl");

    const content = await generateMarketingContent({
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
            useCases: officialUseCases,
            whoFor: officialWhoFor,
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
      mode: contentMode,
      tone: contentTone,
      sourceBasis: {
        hasOfficialInfo,
        hasAiInsight,
        usedFields,
      },
    });

    return NextResponse.json({
      ok: true,
      mode: contentMode,
      tone: contentTone,
      content: content.content,
      titleCandidates: content.titleCandidates ?? [],
      hookLine: content.hookLine ?? "",
      sourceBasis: content.sourceBasis,
      summaryNotes: content.summaryNotes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
