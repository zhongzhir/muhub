import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { canUploadTrainingFile } from "@/app/training/lib/access";
import { TRAINING_2026_EVENT_SLUG } from "@/app/training/lib/current-event";
import { saveTrainingUploadedFile } from "@/app/training/lib/file-storage";

export const dynamic = "force-dynamic";

function cleanText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

async function getUploadContext(userId: string) {
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

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
  }

  const context = await getUploadContext(userId);
  if ("error" in context) return context.error;

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return Response.json({ ok: false, error: "上传表单格式不正确。" }, { status: 400 });
  }

  const file = formData.get("file");
  const groupId = cleanText(formData.get("groupId"));
  const taskId = cleanText(formData.get("taskId"));
  const kind = cleanText(formData.get("kind")) ?? "task_file";
  if (!(file instanceof File)) {
    return Response.json({ ok: false, error: "请选择要上传的文件。" }, { status: 400 });
  }
  if (!groupId) {
    return Response.json({ ok: false, error: "缺少小组信息。" }, { status: 400 });
  }

  const group = await prisma.trainingGroup.findFirst({
    where: { id: groupId, eventId: context.event.id },
  });
  if (!group) {
    return Response.json({ ok: false, error: "小组不存在。" }, { status: 404 });
  }

  if (taskId) {
    const task = await prisma.trainingTask.findFirst({
      where: { id: taskId, eventId: context.event.id },
      select: { id: true },
    });
    if (!task) {
      return Response.json({ ok: false, error: "任务不存在。" }, { status: 404 });
    }
  }

  const accessParticipant = {
    role: context.participant.role,
    classNo: context.participant.classNo,
    groupNo: context.participant.groupNo,
  };
  if (!canUploadTrainingFile(accessParticipant, { classNo: group.classNo, groupNo: group.groupNo })) {
    return Response.json({ ok: false, error: "当前身份无权上传该小组文件。" }, { status: 403 });
  }

  try {
    const stored = await saveTrainingUploadedFile(file, {
      eventSlug: context.event.slug,
      classNo: group.classNo,
      groupNo: group.groupNo,
    });
    const created = await prisma.trainingFile.create({
      data: {
        id: stored.id,
        eventId: context.event.id,
        groupId: group.id,
        taskId,
        uploaderParticipantId: context.participant.id,
        originalName: stored.originalName,
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        kind,
      },
    });

    return Response.json({ ok: true, file: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "文件上传失败。";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
