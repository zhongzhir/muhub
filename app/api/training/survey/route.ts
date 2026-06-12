import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { TRAINING_2026_EVENT_SLUG } from "@/app/training/lib/current-event";

export const dynamic = "force-dynamic";

type SurveyBody = {
  caseQualityScore?: unknown;
  mentorScore?: unknown;
  platformScore?: unknown;
  mostValuablePart?: unknown;
  improvementPart?: unknown;
  willingToContinue?: unknown;
  muhubSuggestion?: unknown;
};

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function parseScore(value: unknown, label: string): number {
  const score = Number(value);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error(`${label}需填写 1 至 5 分。`);
  }
  return score;
}

function parseBoolean(value: unknown): boolean {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  throw new Error("请选择是否愿意继续参与后续交流。");
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, error: "请先登录后再提交调查问卷。" }, { status: 401 });
  }

  const event = await prisma.trainingEvent.findUnique({
    where: { slug: TRAINING_2026_EVENT_SLUG },
  });
  if (!event) {
    return Response.json({ ok: false, error: "活动尚未初始化。" }, { status: 503 });
  }

  const participant = await prisma.trainingParticipant.findUnique({
    where: {
      eventId_userId: {
        eventId: event.id,
        userId,
      },
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });
  if (!participant) {
    return Response.json({ ok: false, error: "请先绑定本次活动身份后再提交调查问卷。" }, { status: 403 });
  }
  if (participant.role === "admin") {
    return Response.json({ ok: false, error: "管理员账号不参与本次满意度调查。" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as SurveyBody;

  try {
    const mostValuablePart = cleanText(body.mostValuablePart);
    const improvementPart = cleanText(body.improvementPart);
    const suggestion = cleanText(body.muhubSuggestion) || null;
    if (!mostValuablePart) throw new Error("请填写最有收获的环节。");
    if (!improvementPart) throw new Error("请填写最需要改进的环节。");

    const payload = {
      name:
        participant.displayName ||
        participant.user.name ||
        participant.user.phone ||
        participant.user.email ||
        "活动参与者",
      classNo: participant.classNo ?? 0,
      groupNo: participant.groupNo ?? 0,
      caseQualityScore: parseScore(body.caseQualityScore, "案例质量评分"),
      mentorScore: parseScore(body.mentorScore, "导师指导评分"),
      platformScore: parseScore(body.platformScore, "平台使用评分"),
      mostValuablePart,
      improvementPart,
      willingToContinue: parseBoolean(body.willingToContinue),
      muhubSuggestion: suggestion,
    };

    const existing = await prisma.trainingSurveyResponse.findFirst({
      where: {
        eventId: event.id,
        participantId: participant.id,
      },
      orderBy: { createdAt: "desc" },
    });

    const saved = existing
      ? await prisma.trainingSurveyResponse.update({
          where: { id: existing.id },
          data: payload,
        })
      : await prisma.trainingSurveyResponse.create({
          data: {
            eventId: event.id,
            participantId: participant.id,
            ...payload,
          },
        });

    return Response.json({ ok: true, survey: saved, mode: existing ? "updated" : "created" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "调查问卷提交失败，请稍后重试。";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
