import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function toStringArray(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = item.trim();
    if (!text) continue;
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const row = await prisma.projectOfficialInfo.findUnique({
    where: { projectId: id },
  });
  return Response.json({ ok: true, officialInfo: row });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const project = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, claimedByUserId: true },
  });
  if (!project) {
    return Response.json({ ok: false, error: "项目不存在或已删除。" }, { status: 404 });
  }
  if (project.claimedByUserId !== session.user.id) {
    return Response.json({ ok: false, error: "仅已认领用户可编辑官方信息。" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    summary?: string;
    fullDescription?: string;
    useCases?: unknown;
    whoFor?: unknown;
    website?: string;
    twitter?: string;
    discord?: string;
    contactEmail?: string;
    teamInfo?: unknown;
    businessInfo?: unknown;
  };
  const data = {
    summary: typeof body.summary === "string" ? body.summary.trim().slice(0, 300) : null,
    fullDescription:
      typeof body.fullDescription === "string" ? body.fullDescription.trim().slice(0, 4000) : null,
    useCases: toStringArray(body.useCases),
    whoFor: toStringArray(body.whoFor),
    website: typeof body.website === "string" ? body.website.trim().slice(0, 500) : null,
    twitter: typeof body.twitter === "string" ? body.twitter.trim().slice(0, 500) : null,
    discord: typeof body.discord === "string" ? body.discord.trim().slice(0, 500) : null,
    contactEmail:
      typeof body.contactEmail === "string" ? body.contactEmail.trim().slice(0, 120) : null,
    teamInfo: body.teamInfo ?? null,
    businessInfo: body.businessInfo ?? null,
  };

  const saved = await prisma.projectOfficialInfo.upsert({
    where: { projectId: id },
    create: {
      projectId: id,
      ownerId: session.user.id,
      summary: data.summary,
      fullDescription: data.fullDescription,
      useCases: data.useCases as unknown as Prisma.InputJsonValue,
      whoFor: data.whoFor as unknown as Prisma.InputJsonValue,
      website: data.website,
      twitter: data.twitter,
      discord: data.discord,
      contactEmail: data.contactEmail,
      teamInfo: (data.teamInfo ?? {}) as Prisma.InputJsonValue,
      businessInfo: (data.businessInfo ?? {}) as Prisma.InputJsonValue,
    },
    update: {
      summary: data.summary,
      fullDescription: data.fullDescription,
      useCases: data.useCases as unknown as Prisma.InputJsonValue,
      whoFor: data.whoFor as unknown as Prisma.InputJsonValue,
      website: data.website,
      twitter: data.twitter,
      discord: data.discord,
      contactEmail: data.contactEmail,
      teamInfo: (data.teamInfo ?? {}) as Prisma.InputJsonValue,
      businessInfo: (data.businessInfo ?? {}) as Prisma.InputJsonValue,
    },
  });

  return Response.json({ ok: true, officialInfo: saved });
}
