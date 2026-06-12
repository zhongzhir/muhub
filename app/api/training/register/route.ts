import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { TRAINING_2026_EVENT_SLUG } from "@/app/training/lib/current-event";

export const dynamic = "force-dynamic";

function normalizeInviteCode(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, error: "请先登录后再绑定活动身份。" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    inviteCode?: string;
    displayName?: string;
    organization?: string;
  };
  const code = normalizeInviteCode(body.inviteCode);
  if (!code) {
    return Response.json({ ok: false, error: "请输入活动邀请码。" }, { status: 400 });
  }

  const event = await prisma.trainingEvent.findUnique({
    where: { slug: TRAINING_2026_EVENT_SLUG },
  });
  if (!event) {
    return Response.json({ ok: false, error: "活动尚未初始化，请联系工作人员。" }, { status: 503 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.trainingParticipant.findUnique({
        where: {
          eventId_userId: {
            eventId: event.id,
            userId,
          },
        },
      });
      if (existing) {
        return { participant: existing, alreadyBound: true };
      }

      const invite = await tx.trainingInvite.findUnique({
        where: { code },
      });
      if (!invite || invite.eventId !== event.id || !invite.isActive) {
        throw new TrainingRegisterError("邀请码无效或已停用。", 400);
      }
      if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
        throw new TrainingRegisterError("该邀请码使用次数已满，请联系工作人员。", 400);
      }

      const group =
        invite.classNo !== null && invite.groupNo !== null
          ? await tx.trainingGroup.findUnique({
              where: {
                eventId_classNo_groupNo: {
                  eventId: event.id,
                  classNo: invite.classNo,
                  groupNo: invite.groupNo,
                },
              },
            })
          : null;

      const participant = await tx.trainingParticipant.create({
        data: {
          eventId: event.id,
          userId,
          role: invite.role,
          classNo: invite.classNo,
          groupNo: invite.groupNo,
          groupId: group?.id ?? null,
          inviteCode: invite.code,
          displayName: String(body.displayName ?? session.user?.name ?? "").trim() || null,
          organization: String(body.organization ?? "").trim() || null,
          phone: (session.user as { phone?: string | null } | undefined)?.phone ?? null,
        },
      });

      await tx.trainingInvite.update({
        where: { id: invite.id },
        data: { usedCount: { increment: 1 } },
      });

      return { participant, alreadyBound: false };
    });

    return Response.json({
      ok: true,
      alreadyBound: result.alreadyBound,
      participant: {
        role: result.participant.role,
        classNo: result.participant.classNo,
        groupNo: result.participant.groupNo,
      },
    });
  } catch (error) {
    if (error instanceof TrainingRegisterError) {
      return Response.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}

class TrainingRegisterError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TrainingRegisterError";
  }
}
