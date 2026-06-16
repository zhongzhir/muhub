import { AdminAuthError } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

import { requireTrainingAdmin } from "@/app/training/lib/admin-auth";
import { buildCsv, csvDownloadHeaders } from "@/app/training/lib/csv";
import { TRAINING_2026_EVENT_SLUG } from "@/app/training/lib/current-event";

export const dynamic = "force-dynamic";

function uploaderName(file: {
  uploaderParticipant: {
    displayName: string | null;
    user: { name: string | null; email: string | null; phone: string | null };
  } | null;
}) {
  const uploader = file.uploaderParticipant;
  if (!uploader) return "未知成员";
  return uploader.displayName || uploader.user.name || uploader.user.phone || uploader.user.email || "未知成员";
}

export async function GET() {
  try {
    await requireTrainingAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return Response.json({ ok: false, error: error.message }, { status: error.code === "UNAUTHORIZED" ? 401 : 403 });
    }
    throw error;
  }

  const event = await prisma.trainingEvent.findUnique({
    where: { slug: TRAINING_2026_EVENT_SLUG },
  });
  if (!event) {
    return Response.json({ ok: false, error: "活动尚未初始化。" }, { status: 503 });
  }

  const files = await prisma.trainingFile.findMany({
    where: { eventId: event.id },
    include: {
      group: true,
      task: true,
      uploaderParticipant: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    },
    orderBy: [{ group: { classNo: "asc" } }, { group: { groupNo: "asc" } }, { createdAt: "desc" }],
  });

  const csv = buildCsv([
    ["班级", "小组", "任务", "文件名", "上传人", "文件大小", "上传时间", "文件ID"],
    ...files.map((file) => [
      file.group.classNo,
      file.group.groupNo,
      file.task?.title ?? "未绑定任务",
      file.originalName,
      uploaderName(file),
      file.sizeBytes,
      file.createdAt.toLocaleString("zh-CN", { hour12: false }),
      file.id,
    ]),
  ]);

  return new Response(csv, {
    headers: csvDownloadHeaders(`training-files-${new Date().toISOString().slice(0, 10)}.csv`),
  });
}
