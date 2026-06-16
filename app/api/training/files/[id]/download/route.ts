import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { canDownloadTrainingFile } from "@/app/training/lib/access";
import { isTrainingAdminUser } from "@/app/training/lib/admin-auth";
import { TRAINING_2026_EVENT_SLUG } from "@/app/training/lib/current-event";
import { readTrainingStoredFile } from "@/app/training/lib/file-storage";

export const dynamic = "force-dynamic";

function contentDisposition(name: string): string {
  const fallback = name.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "");
  return `attachment; filename="${fallback || "training-file"}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, error: "请先登录。" }, { status: 401 });
  }

  const event = await prisma.trainingEvent.findUnique({
    where: { slug: TRAINING_2026_EVENT_SLUG },
  });
  if (!event) {
    return Response.json({ ok: false, error: "活动尚未初始化。" }, { status: 503 });
  }

  const { id } = await params;
  const file = await prisma.trainingFile.findFirst({
    where: { id, eventId: event.id },
    include: { group: true },
  });
  if (!file) {
    return Response.json({ ok: false, error: "文件不存在。" }, { status: 404 });
  }

  const isTrainingAdmin = isTrainingAdminUser({
    id: session.user?.id,
    email: session.user?.email,
    phone: (session.user as { phone?: string | null } | undefined)?.phone ?? null,
    role: (session.user as { role?: string | null } | undefined)?.role ?? null,
  });
  const participant = await prisma.trainingParticipant.findUnique({
    where: {
      eventId_userId: {
        eventId: event.id,
        userId,
      },
    },
  });
  const accessParticipant = participant
    ? {
        role: participant.role,
        classNo: participant.classNo,
        groupNo: participant.groupNo,
      }
    : isTrainingAdmin
      ? {
          role: "admin",
          classNo: null,
          groupNo: null,
        }
      : null;

  if (!canDownloadTrainingFile(accessParticipant, { classNo: file.group.classNo, groupNo: file.group.groupNo })) {
    return Response.json({ ok: false, error: "无权下载该小组文件。" }, { status: 403 });
  }

  try {
    const stored = await readTrainingStoredFile(file.storageKey);
    return new Response(stored.data, {
      headers: {
        "Content-Disposition": contentDisposition(file.originalName),
        "Content-Length": String(stored.sizeBytes),
        "Content-Type": file.mimeType || "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ ok: false, error: "文件不存在或无法读取。" }, { status: 404 });
  }
}
