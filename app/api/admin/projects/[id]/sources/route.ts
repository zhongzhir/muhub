import { revalidatePath } from "next/cache";
import type { ProjectSourceKind } from "@prisma/client";

import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { recordOperatorSourceVisibilityChange } from "@/lib/operator-learning";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SOURCE_KIND_SET = new Set<ProjectSourceKind>([
  "GITHUB",
  "GITEE",
  "WEBSITE",
  "DOCS",
  "BLOG",
  "TWITTER",
  "WECHAT",
  "WECHAT_ARTICLE",
  "XIAOHONGSHU",
  "DOUYIN",
  "ZHIHU",
  "BILIBILI",
  "DISCORD",
  "OTHER",
]);

const UNSUPPORTED_KIND_LABELS: Record<string, string> = {
  PLATFORM_PAGE: "平台项目页",
  MEDIA_ARTICLE: "媒体报道",
  SOCIAL: "社交媒体",
  MANUAL: "手动资料",
};

function authError(error: unknown) {
  if (error instanceof AdminAuthError) {
    return Response.json(
      { ok: false, error: error.message },
      { status: error.code === "UNAUTHORIZED" ? 401 : 403 },
    );
  }
  throw error;
}

function cleanOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeUrl(value: unknown, kindChoice: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    if (kindChoice === "MANUAL") {
      return `manual://admin-entry/${Date.now()}`;
    }
    throw new Error("请填写来源 URL。");
  }
  if (/^manual:\/\//i.test(raw)) {
    return raw;
  }
  try {
    return new URL(raw).href;
  } catch {
    throw new Error("来源 URL 格式不正确，请填写完整的 http(s) 地址。");
  }
}

function mapKind(raw: unknown, rawLabel: string | null): { kind: ProjectSourceKind; label: string | null } {
  const kindChoice = typeof raw === "string" && raw.trim() ? raw.trim().toUpperCase() : "OTHER";
  if (SOURCE_KIND_SET.has(kindChoice as ProjectSourceKind)) {
    return { kind: kindChoice as ProjectSourceKind, label: rawLabel };
  }
  if (kindChoice === "GITCC") {
    return { kind: "OTHER", label: rawLabel ?? "GitCC" };
  }
  if (kindChoice === "PLATFORM_PAGE") {
    return { kind: "OTHER", label: rawLabel ?? "平台项目页" };
  }
  if (kindChoice === "MEDIA_ARTICLE") {
    return { kind: "BLOG", label: rawLabel ?? "媒体报道" };
  }
  if (kindChoice === "SOCIAL") {
    return { kind: "TWITTER", label: rawLabel ?? "社交媒体" };
  }
  if (kindChoice === "MANUAL") {
    return { kind: "OTHER", label: rawLabel ?? "手动资料" };
  }
  return { kind: "OTHER", label: rawLabel ?? UNSUPPORTED_KIND_LABELS[kindChoice] ?? kindChoice };
}

async function findProject(id: string) {
  return prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, slug: true, name: true },
  });
}

function serializeSource(source: {
  id: string;
  kind: ProjectSourceKind;
  title: string | null;
  url: string;
  label: string | null;
  summary: string | null;
  content: string | null;
  isPrimary: boolean;
  createdAt: Date;
}) {
  return {
    id: source.id,
    kind: source.kind,
    title: source.title ?? "",
    url: source.url,
    label: source.label ?? "",
    summary: source.summary ?? "",
    content: source.content ?? "",
    isPrimary: source.isPrimary,
    createdAt: source.createdAt.toISOString(),
    updatedAt: "",
  };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireMuHubAdmin();
  } catch (error) {
    return authError(error);
  }

  const { id } = await ctx.params;
  const project = await findProject(id);
  if (!project) {
    return Response.json({ ok: false, error: "Project not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const kindChoice = typeof body.kind === "string" && body.kind.trim() ? body.kind.trim().toUpperCase() : "OTHER";
  const label = cleanOptionalString(body.label);
  let url: string;
  try {
    url = normalizeUrl(body.url, kindChoice);
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Invalid source URL" },
      { status: 400 },
    );
  }
  const mapped = mapKind(kindChoice, label);
  const isPrimary = Boolean(body.isPrimary);

  const source = await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.projectSource.updateMany({
        where: { projectId: project.id, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    return tx.projectSource.create({
      data: {
        projectId: project.id,
        kind: mapped.kind,
        url,
        label: mapped.label,
        title: cleanOptionalString(body.title),
        summary: cleanOptionalString(body.summary),
        content: cleanOptionalString(body.content),
        isPrimary,
      },
    });
  });

  revalidatePath(`/admin/projects/${project.id}/edit`);
  revalidatePath(`/projects/${project.slug}`);

  return Response.json({ ok: true, source: serializeSource(source) });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireMuHubAdmin();
  } catch (error) {
    return authError(error);
  }

  const { id } = await ctx.params;
  const project = await findProject(id);
  if (!project) {
    return Response.json({ ok: false, error: "Project not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sourceId = cleanOptionalString(body.sourceId);
  if (!sourceId) {
    return Response.json({ ok: false, error: "Missing sourceId" }, { status: 400 });
  }
  const existing = await prisma.projectSource.findFirst({
    where: { id: sourceId, projectId: project.id },
    select: { id: true, kind: true, visibility: true },
  });
  if (!existing) {
    return Response.json({ ok: false, error: "Source not found" }, { status: 404 });
  }

  const kindChoice =
    typeof body.kind === "string" && body.kind.trim() ? body.kind.trim().toUpperCase() : existing.kind;
  const label = cleanOptionalString(body.label);
  let url: string;
  try {
    url = normalizeUrl(body.url, kindChoice);
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Invalid source URL" },
      { status: 400 },
    );
  }
  const mapped = mapKind(kindChoice, label);
  const isPrimary = Boolean(body.isPrimary);
  const visibilityRaw = cleanOptionalString(body.visibility);
  const visibility =
    visibilityRaw === "public" || visibilityRaw === "internal"
      ? visibilityRaw
      : undefined;

  const source = await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.projectSource.updateMany({
        where: { projectId: project.id, isPrimary: true, id: { not: sourceId } },
        data: { isPrimary: false },
      });
    }
    return tx.projectSource.update({
      where: { id: sourceId },
      data: {
        kind: mapped.kind,
        url,
        label: mapped.label,
        title: cleanOptionalString(body.title),
        summary: cleanOptionalString(body.summary),
        content: cleanOptionalString(body.content),
        isPrimary,
        ...(visibility ? { visibility } : {}),
      },
    });
  });

  if (visibility && visibility !== existing.visibility) {
    await recordOperatorSourceVisibilityChange({
      projectId: project.id,
      projectName: project.name,
      sourceId,
      beforeVisibility: existing.visibility,
      afterVisibility: visibility,
    });
  }

  revalidatePath(`/admin/projects/${project.id}/edit`);
  revalidatePath(`/projects/${project.slug}`);

  return Response.json({ ok: true, source: serializeSource(source) });
}
