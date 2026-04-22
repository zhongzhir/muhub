"use server";

import { revalidatePath } from "next/cache";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getDiscoverySignalPriority } from "@/lib/discovery/signal-priority";
import { getDiscoverySignalSourceStats } from "@/lib/discovery/signal-source-stats";
import { convertDiscoverySignalToCandidateWithOverrides } from "@/lib/discovery/signals";
import {
  generateSignalAiInsight,
  type SignalAiInsight,
} from "@/lib/discovery/signal-ai-insight";

export type GenerateSignalAiInsightResult =
  | { ok: true; insight: SignalAiInsight }
  | { ok: false; error: string };
type ConvertWithAiAccepted = {
  acceptedName?: string | null;
  acceptedCategory?: string | null;
  acceptedSimpleSummary?: string | null;
};
export type ConvertSignalWithAiResult =
  | { ok: true; candidateId: string }
  | { ok: false; error: string };

export async function generateSignalAiInsightAction(
  signalId: string,
): Promise<GenerateSignalAiInsightResult> {
  try {
    await requireMuHubAdmin();
    const signal = await prisma.discoverySignal.findUnique({
      where: { id: signalId },
      select: {
        id: true,
        title: true,
        summary: true,
        rawText: true,
        sourceType: true,
        sourceName: true,
        url: true,
        referenceSources: true,
        guessedProjectName: true,
        guessedWebsiteUrl: true,
        guessedGithubUrl: true,
      },
    });
    if (!signal) {
      return { ok: false, error: "线索不存在" };
    }

    const priority = getDiscoverySignalPriority({
      sourceType: signal.sourceType,
      title: signal.title,
      summary: signal.summary,
      guessedProjectName: signal.guessedProjectName,
      guessedWebsiteUrl: signal.guessedWebsiteUrl,
      guessedGithubUrl: signal.guessedGithubUrl,
      referenceSources: signal.referenceSources,
    });
    const sourceStats = getDiscoverySignalSourceStats(signal.referenceSources);

    return generateSignalAiInsight({
      title: signal.title,
      summary: signal.summary,
      rawText: signal.rawText,
      sourceType: signal.sourceType,
      sourceName: signal.sourceName,
      url: signal.url,
      referenceSources: signal.referenceSources,
      guessedProjectName: signal.guessedProjectName,
      guessedWebsiteUrl: signal.guessedWebsiteUrl,
      guessedGithubUrl: signal.guessedGithubUrl,
      priority: priority.priority,
      priorityNote: priority.note,
      sourceStatsText: sourceStats.summaryText,
      sourceStatsTotal: sourceStats.total,
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function sanitizeInsight(raw: unknown): SignalAiInsight | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const lp = typeof obj.likelyProject === "string" ? obj.likelyProject.toUpperCase() : "";
  if (lp !== "HIGH" && lp !== "MEDIUM" && lp !== "LOW") {
    return null;
  }
  const reasons = Array.isArray(obj.reasons)
    ? obj.reasons.filter((r): r is string => typeof r === "string" && r.trim().length > 0).slice(0, 8)
    : [];
  if (reasons.length === 0) {
    return null;
  }
  return {
    likelyProject: lp,
    suggestedName: typeof obj.suggestedName === "string" ? obj.suggestedName.trim() || undefined : undefined,
    suggestedSummary:
      typeof obj.suggestedSummary === "string" ? obj.suggestedSummary.trim() || undefined : undefined,
    suggestedCategory:
      typeof obj.suggestedCategory === "string" ? obj.suggestedCategory.trim() || undefined : undefined,
    recommendation:
      typeof obj.recommendation === "string" ? obj.recommendation.trim() || undefined : undefined,
    reasons,
  };
}

export async function convertSignalToCandidateWithAiAction(
  signalId: string,
  insightInput?: unknown,
  accepted?: ConvertWithAiAccepted,
): Promise<ConvertSignalWithAiResult> {
  try {
    await requireMuHubAdmin();
    const signal = await prisma.discoverySignal.findUnique({
      where: { id: signalId },
      select: {
        id: true,
        title: true,
        summary: true,
        rawText: true,
        sourceType: true,
        sourceName: true,
        url: true,
        referenceSources: true,
        guessedProjectName: true,
        guessedWebsiteUrl: true,
        guessedGithubUrl: true,
      },
    });
    if (!signal) {
      return { ok: false, error: "线索不存在" };
    }

    const frontendInsight = sanitizeInsight(insightInput);
    let aiInsight = frontendInsight;
    if (!aiInsight) {
      const generated = await generateSignalAiInsight({
        title: signal.title,
        summary: signal.summary,
        rawText: signal.rawText,
        sourceType: signal.sourceType,
        sourceName: signal.sourceName,
        url: signal.url,
        referenceSources: signal.referenceSources,
        guessedProjectName: signal.guessedProjectName,
        guessedWebsiteUrl: signal.guessedWebsiteUrl,
        guessedGithubUrl: signal.guessedGithubUrl,
        priority: getDiscoverySignalPriority({
          sourceType: signal.sourceType,
          title: signal.title,
          summary: signal.summary,
          guessedProjectName: signal.guessedProjectName,
          guessedWebsiteUrl: signal.guessedWebsiteUrl,
          guessedGithubUrl: signal.guessedGithubUrl,
          referenceSources: signal.referenceSources,
        }).priority,
        priorityNote: "",
        sourceStatsText: getDiscoverySignalSourceStats(signal.referenceSources).summaryText,
        sourceStatsTotal: getDiscoverySignalSourceStats(signal.referenceSources).total,
      });
      if (!generated.ok) {
        return { ok: false, error: "AI 数据缺失，请先生成分析后重试。" };
      }
      aiInsight = generated.insight;
    }
    const ai = aiInsight;
    const title =
      accepted?.acceptedName?.trim() ||
      ai.suggestedName?.trim() ||
      signal.guessedProjectName?.trim() ||
      signal.title;
    const summary = ai.suggestedSummary?.trim() || signal.summary?.trim() || null;
    const suggestedCategory = accepted?.acceptedCategory?.trim() || ai.suggestedCategory?.trim() || null;
    const simpleSummaryCandidate =
      accepted?.acceptedSimpleSummary?.trim() || ai.suggestedSummary?.trim() || null;

    const result = await convertDiscoverySignalToCandidateWithOverrides(signalId, {
      title,
      summary,
      suggestedCategory,
      simpleSummaryCandidate,
      website: signal.guessedWebsiteUrl,
      repoUrl: signal.guessedGithubUrl,
      aiInsightRaw: ai,
    });

    revalidatePath("/admin/discovery/signals");
    revalidatePath(`/admin/discovery/signals/${signalId}`);
    revalidatePath("/admin/discovery");
    revalidatePath(`/admin/discovery/${result.candidateId}`);
    return { ok: true, candidateId: result.candidateId };
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
