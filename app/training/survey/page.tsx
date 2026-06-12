import Link from "next/link";
import type { Metadata } from "next";

import { TrainingPageShell } from "../_components/training-chrome";
import { SurveyForm } from "../_components/survey-form";
import { requireTrainingLogin } from "../lib/auth";
import { getTrainingSurveyResponseForParticipant } from "../lib/queries";

export const metadata: Metadata = {
  title: "满意度调查 | 出版融合发展工程实践交流活动",
  description: "提交本次实践交流活动满意度调查。",
  robots: { index: false },
};

function roleLabel(role: string) {
  if (role === "student") return "学员";
  if (role === "mentor") return "导师";
  if (role === "admin") return "管理员";
  return role;
}

export default async function TrainingSurveyPage() {
  const context = await requireTrainingLogin("/training/survey");

  if (!context.participant) {
    return (
      <TrainingPageShell
        title="满意度调查"
        subtitle="请先绑定本次活动身份，再提交满意度调查。"
      >
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            你已登录，但尚未绑定本次实践交流活动身份。请先完成身份绑定后再填写调查问卷。
          </p>
          <Link
            href="/training/register"
            className="mt-5 inline-flex rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-400"
          >
            去绑定活动身份
          </Link>
        </div>
      </TrainingPageShell>
    );
  }

  const survey = await getTrainingSurveyResponseForParticipant(context.userId);
  const participant = context.participant;
  const name =
    participant.displayName ||
    participant.user.name ||
    participant.user.phone ||
    participant.user.email ||
    "活动参与者";

  return (
    <TrainingPageShell
      title="满意度调查"
      subtitle="请结合本次实践交流活动的案例质量、导师指导和平台使用体验填写反馈。"
    >
      <SurveyForm
        identity={{
          name,
          roleLabel: roleLabel(participant.role),
          classLabel: participant.classNo ? `${participant.classNo} 班` : "未分班",
          groupLabel: participant.groupNo ? `${participant.groupNo} 组` : "导师/未分组",
        }}
        initialValue={
          survey
            ? {
                caseQualityScore: survey.caseQualityScore,
                mentorScore: survey.mentorScore,
                platformScore: survey.platformScore,
                mostValuablePart: survey.mostValuablePart,
                improvementPart: survey.improvementPart,
                willingToContinue: survey.willingToContinue,
                muhubSuggestion: survey.muhubSuggestion ?? "",
              }
            : undefined
        }
      />
    </TrainingPageShell>
  );
}
