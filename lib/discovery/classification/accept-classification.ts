import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { persistReviewPriorityForCandidateId } from "@/lib/discovery/persist-review-priority";

function asStringArray(j: unknown): string[] {
  if (!Array.isArray(j)) {
    return [];
  }
  return j
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

export type AcceptClassificationResult = {
  categoriesAppended: boolean;
  tagsMergedCount: number;
};

/**
 * 将建议类型/标签合并入正式 categoriesJson、tagsJson（仅追加缺失项），并标记 ACCEPTED。
 */
export async function acceptDiscoveryClassification(
  candidateId: string,
): Promise<AcceptClassificationResult> {
  const c = await prisma.discoveryCandidate.findUnique({ where: { id: candidateId } });
  if (!c) {
    throw new Error("候选不存在");
  }
  if (c.classificationStatus !== "DONE") {
    throw new Error("仅能在分类状态为 DONE 时接受（请先运行 Classify）");
  }

  const suggestedType = c.suggestedType?.trim() ?? "";
  const suggestedTags = asStringArray(c.suggestedTagsJson);

  const existingCategories = asStringArray(c.categoriesJson);
  const existingTags = asStringArray(c.tagsJson);

  const categories = [...existingCategories];
  let categoriesAppended = false;
  if (suggestedType) {
    const has = categories.some((x) => x.toLowerCase() === suggestedType.toLowerCase());
    if (!has) {
      categories.push(suggestedType);
      categoriesAppended = true;
    }
  }

  const mergedTags = [...existingTags];
  const seen = new Set(mergedTags.map((t) => t.toLowerCase()));
  let tagsMergedCount = 0;
  for (const t of suggestedTags) {
    const k = t.toLowerCase();
    if (seen.has(k)) {
      continue;
    }
    seen.add(k);
    mergedTags.push(t);
    tagsMergedCount += 1;
  }

  const data: Prisma.DiscoveryCandidateUpdateInput = {
    classificationStatus: "ACCEPTED",
  };
  if (categoriesAppended) {
    data.categoriesJson = categories as unknown as Prisma.InputJsonValue;
  }
  if (tagsMergedCount > 0) {
    data.tagsJson = mergedTags as unknown as Prisma.InputJsonValue;
  }

  await prisma.discoveryCandidate.update({
    where: { id: candidateId },
    data,
  });

  await persistReviewPriorityForCandidateId(prisma, candidateId);

  return { categoriesAppended, tagsMergedCount };
}
