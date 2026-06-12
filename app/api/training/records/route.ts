import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import {
  canCreateTrainingRecord,
  canUpdateTrainingRecord,
  isTrainingRecordType,
} from "@/app/training/lib/access";
import { TRAINING_2026_EVENT_SLUG } from "@/app/training/lib/current-event";

export const dynamic = "force-dynamic";

type RecordBody = {
  id?: string;
  groupId?: string;
  taskId?: string | null;
  type?: string;
  title?: string;
  content?: string;
  contentJson?: unknown;
};

function cleanText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function jsonObjectOrUndefined(value: unknown): object | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value;
}

async function getWriteContext(userId: string) {
  const event = await prisma.trainingEvent.findUnique({
    where: { slug: TRAINING_2026_EVENT_SLUG },
  });
  if (!event) {
    return { error: Response.json({ ok: false, error: "活动尚未初始化。" }, { status: 503 }) };
  }

  const participant = await prisma.trainingParticipant.findUnique({
    where: {
      eventId_userId: {
        eventId: event.id,
        userId,
      },
    },
  });
  if (!participant) {
    return { error: Response.json({ ok: false, error: "请先绑定活动身份。" }, { status: 403 }) };
  }

  return { event, participant };
}

async function findGroupForEvent(eventId: string, groupId: string | undefined) {
  if (!groupId) return null;
  return prisma.trainingGroup.findFirst({
    where: { id: groupId, eventId },
  });
}

async function validTaskForEvent(eventId: string, taskId: string | null | undefined) {
  if (!taskId) return true;
  const task = await prisma.trainingTask.findFirst({
    where: { id: taskId, eventId },
    select: { id: true },
  });
  return Boolean(task);
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
  }

  const context = await getWriteContext(userId);
  if ("error" in context) return context.error;

  const body = (await req.json().catch(() => ({}))) as RecordBody;
  const type = String(body.type ?? "");
  if (!isTrainingRecordType(type)) {
    return Response.json({ ok: false, error: "不支持的记录类型。" }, { status: 400 });
  }

  const group = await findGroupForEvent(context.event.id, body.groupId);
  if (!group) {
    return Response.json({ ok: false, error: "小组不存在。" }, { status: 404 });
  }
  if (!(await validTaskForEvent(context.event.id, body.taskId))) {
    return Response.json({ ok: false, error: "任务不存在。" }, { status: 404 });
  }

  const accessParticipant = {
    role: context.participant.role,
    classNo: context.participant.classNo,
    groupNo: context.participant.groupNo,
  };
  const target = { classNo: group.classNo, groupNo: group.groupNo };
  if (!canCreateTrainingRecord(accessParticipant, target, type)) {
    return Response.json({ ok: false, error: "无权写入该小组记录。" }, { status: 403 });
  }

  if (type === "final_submission") {
    const existing = await prisma.trainingRecord.findFirst({
      where: {
        eventId: context.event.id,
        groupId: group.id,
        type,
      },
      orderBy: { updatedAt: "desc" },
    });
    if (existing) {
      const updated = await prisma.trainingRecord.update({
        where: { id: existing.id },
        data: {
          taskId: body.taskId || null,
          authorParticipantId: context.participant.id,
          title: cleanText(body.title),
          content: cleanText(body.content),
          contentJson: jsonObjectOrUndefined(body.contentJson),
        },
      });
      return Response.json({ ok: true, record: updated, mode: "updated" });
    }
  }

  const created = await prisma.trainingRecord.create({
    data: {
      eventId: context.event.id,
      groupId: group.id,
      taskId: body.taskId || null,
      authorParticipantId: context.participant.id,
      type,
      title: cleanText(body.title),
      content: cleanText(body.content),
      contentJson: jsonObjectOrUndefined(body.contentJson),
    },
  });

  return Response.json({ ok: true, record: created, mode: "created" });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
  }

  const context = await getWriteContext(userId);
  if ("error" in context) return context.error;

  const body = (await req.json().catch(() => ({}))) as RecordBody;
  const id = cleanText(body.id);
  if (!id) {
    return Response.json({ ok: false, error: "缺少记录 ID。" }, { status: 400 });
  }

  const record = await prisma.trainingRecord.findFirst({
    where: { id, eventId: context.event.id },
    include: { group: true },
  });
  if (!record || !isTrainingRecordType(record.type)) {
    return Response.json({ ok: false, error: "记录不存在。" }, { status: 404 });
  }

  const accessParticipant = {
    role: context.participant.role,
    classNo: context.participant.classNo,
    groupNo: context.participant.groupNo,
  };
  const allowed = canUpdateTrainingRecord(
    accessParticipant,
    { classNo: record.group.classNo, groupNo: record.group.groupNo },
    {
      type: record.type,
      authorParticipantId: record.authorParticipantId,
      requesterParticipantId: context.participant.id,
    },
  );
  if (!allowed) {
    return Response.json({ ok: false, error: "无权修改该记录。" }, { status: 403 });
  }

  const updated = await prisma.trainingRecord.update({
    where: { id: record.id },
    data: {
      title: cleanText(body.title),
      content: cleanText(body.content),
      contentJson: jsonObjectOrUndefined(body.contentJson),
    },
  });

  return Response.json({ ok: true, record: updated });
}
