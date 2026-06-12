import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";

import { buildCsv, csvDownloadHeaders } from "@/app/training/lib/csv";
import { listTrainingSurveyResponsesForAdmin } from "@/app/training/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireMuHubAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return Response.json({ ok: false, error: error.message }, { status: error.code === "UNAUTHORIZED" ? 401 : 403 });
    }
    throw error;
  }

  const rows = await listTrainingSurveyResponsesForAdmin();
  const csv = buildCsv([
    ["姓名", "班级", "小组", "案例质量评分", "导师指导评分", "平台使用评分", "最有收获的环节", "最需要改进的环节", "是否愿意继续参与", "对 MUHUB / training.muhub.cn 的建议", "提交时间"],
    ...rows.map((row) => [
      row.name,
      row.classNo,
      row.groupNo <= 0 ? "导师/未分组" : row.groupNo,
      row.caseQualityScore,
      row.mentorScore,
      row.platformScore,
      row.mostValuablePart,
      row.improvementPart,
      row.willingToContinue ? "愿意" : "暂不考虑",
      row.muhubSuggestion ?? "",
      row.createdAt.toLocaleString("zh-CN", { hour12: false }),
    ]),
  ]);

  return new Response(csv, {
    headers: csvDownloadHeaders(`training-survey-${new Date().toISOString().slice(0, 10)}.csv`),
  });
}
