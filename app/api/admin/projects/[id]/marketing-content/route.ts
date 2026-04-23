import { NextRequest, NextResponse } from "next/server";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { generateMarketingContent } from "@/lib/ai/marketing/marketing-generator";

export const dynamic = "force-dynamic";

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
    const { mode } = (await req.json().catch(() => ({}))) as { mode?: "social" | "article" };
    const { id } = await ctx.params;
    const contentMode = mode === "article" ? "article" : "social";

    const project = await prisma.project.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        tagline: true,
        description: true,
        tags: true,
        aiInsight: true,
      },
    });

    if (!project) {
      return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
    }

    const content = await generateMarketingContent({
      project: {
        name: project.name,
        tagline: project.tagline,
        description: project.description,
        tags: project.tags,
      },
      aiInsight: project.aiInsight,
      mode: contentMode,
    });

    return NextResponse.json({
      ok: true,
      content,
      mode: contentMode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
