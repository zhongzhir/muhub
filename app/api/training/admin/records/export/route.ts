import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

import { buildCsv, csvDownloadHeaders } from "@/app/training/lib/csv";
import { TRAINING_2026_EVENT_SLUG } from "@/app/training/lib/current-event";

export const dynamic = "force-dynamic";

function authorName(record: {
  authorParticipant: {
    displayName: string | null;
    user: { name: string | null; email: string | null; phone: string | null };
  } | null;
}) {
  const author = record.authorParticipant;
  if (!author) return "未知成员";
  return author.displayName || author.user.name || author.user.phone || author.user.email || "未知成员";
}

function typeLabel(type: string) {
  if (type === "discussion_note") return "讨论纪要";
  if (type === "task_submission") return "阶段成果";
  if (type === "mentor_review") return "导师点评";
  if (type === "final_submission") return "最终成果";
  return type;
}

export async function GET() {
  try {
    await requireMuHubAdmin();
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

  const records = await prisma.trainingRecord.findMany({
    where: { eventId: event.id },
    include: {
      group: true,
      task: true,
      authorParticipant: {
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
    orderBy: [{ group: { classNo: "asc" } }, { group: { groupNo: "asc" } }, { updatedAt: "desc" }],
  });

  const csv = buildCsv([
    ["班级", "小组", "任务", "记录类型", "标题", "内容", "作者", "创建时间", "更新时间"],
    ...records.map((record) => [
      record.group.classNo,
      record.group.groupNo,
      record.task?.title ?? "未绑定任务",
      typeLabel(record.type),
      record.title ?? "",
      record.content ?? "",
      authorName(record),
      record.createdAt.toLocaleString("zh-CN", { hour12: false }),
      record.updatedAt.toLocaleString("zh-CN", { hour12: false }),
    ]),
  ]);

  return new Response(csv, {
    headers: csvDownloadHeaders(`training-records-${new Date().toISOString().slice(0, 10)}.csv`),
  });
}
