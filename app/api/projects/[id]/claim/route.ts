import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const LIMITS = {
  claimantName: 80,
  claimantRole: 80,
  organizationName: 120,
  contactEmail: 120,
  contactWechat: 120,
  contactPhone: 60,
  proofUrl: 500,
  message: 2000,
};

function field(body: Record<string, unknown>, key: keyof typeof LIMITS): string {
  const value = typeof body[key] === "string" ? body[key] : "";
  return value.trim().slice(0, LIMITS[key]);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isLikelyEmail(value: string): boolean {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function contactDuplicateWhere(projectId: string, since: Date, contacts: {
  contactEmail: string;
  contactWechat: string;
  contactPhone: string;
}) {
  const OR = [
    contacts.contactEmail ? { contactEmail: contacts.contactEmail } : null,
    contacts.contactWechat ? { contactWechat: contacts.contactWechat } : null,
    contacts.contactPhone ? { contactPhone: contacts.contactPhone } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    projectId,
    createdAt: { gte: since },
    OR,
  };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL?.trim()) {
    return Response.json({ ok: false, error: "当前未配置数据库，无法提交认领申请。" }, { status: 503 });
  }

  const { id: slugOrId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const claimantName = field(body, "claimantName");
  const claimantRole = field(body, "claimantRole");
  const organizationName = field(body, "organizationName");
  const contactEmail = normalizeEmail(field(body, "contactEmail"));
  const contactWechat = field(body, "contactWechat");
  const contactPhone = field(body, "contactPhone");
  const proofUrl = field(body, "proofUrl");
  const message = field(body, "message");

  if (!claimantName) {
    return Response.json({ ok: false, error: "请填写姓名 / 联系人。" }, { status: 400 });
  }
  if (!claimantRole) {
    return Response.json({ ok: false, error: "请填写你与项目的关系。" }, { status: 400 });
  }
  if (!(contactEmail || contactWechat || contactPhone)) {
    return Response.json({ ok: false, error: "请至少填写邮箱、微信号或手机号中的一项。" }, { status: 400 });
  }
  if (!isLikelyEmail(contactEmail)) {
    return Response.json({ ok: false, error: "邮箱格式不正确。" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: {
      ...PROJECT_ACTIVE_FILTER,
      OR: [{ slug: slugOrId }, { id: slugOrId }],
    },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  if (!project) {
    return Response.json({ ok: false, error: "项目不存在或已下架。" }, { status: 404 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const duplicateWhere = contactDuplicateWhere(project.id, since, {
    contactEmail,
    contactWechat,
    contactPhone,
  });
  if (duplicateWhere.OR.length > 0) {
    const duplicate = await prisma.projectClaim.findFirst({
      where: duplicateWhere,
      select: { id: true },
    });
    if (duplicate) {
      return Response.json(
        { ok: true, duplicate: true, message: "你已经提交过认领申请，请等待处理。" },
        { status: 200 },
      );
    }
  }

  const claim = await prisma.projectClaim.create({
    data: {
      projectId: project.id,
      projectSlug: project.slug,
      projectName: project.name,
      claimantName,
      claimantRole,
      organizationName: organizationName || null,
      contactEmail: contactEmail || null,
      contactWechat: contactWechat || null,
      contactPhone: contactPhone || null,
      proofUrl: proofUrl || null,
      message: message || null,
      status: "PENDING",
      userEmail: contactEmail || null,
      reason: message || proofUrl || null,
    },
    select: { id: true, status: true },
  });

  return Response.json({
    ok: true,
    claimId: claim.id,
    status: claim.status,
    message: "认领申请已提交。MUHUB 管理员会在核验后与你联系。",
  });
}
