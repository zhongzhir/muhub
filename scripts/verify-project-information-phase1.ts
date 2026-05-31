import assert from "node:assert/strict";

import { resolveProjectInformation } from "@/lib/project-information-resolver";
import { evaluateProjectPublishReadiness } from "@/lib/project-publishing";

const baseDraft = {
  id: "project_1",
  name: "Phase 1 Demo",
  slug: "phase-1-demo",
  status: "DRAFT",
  visibilityStatus: "DRAFT",
  publishedAt: null,
  tagline: null,
  description: null,
  primaryCategory: null,
  aiCardSummary: null,
  aiInsightStatus: "success",
  aiContentStatus: "failed",
  aiStatus: "done_partial",
  aiInsight: {
    summary: "AI structured summary",
    whatItIs: "A useful project with enough structured knowledge.",
    whoFor: ["builders"],
    useCases: ["testing release readiness"],
  },
  aiKnowledgeJson: {
    version: "v1",
    primaryCategory: "AI_AGENT",
    techSignals: ["agent"],
    targetUsers: ["builders"],
    generatedAt: "2026-05-31T00:00:00.000Z",
  },
  websiteUrl: "https://example.com",
  githubUrl: null,
  sources: [
    {
      kind: "WEBSITE",
      url: "https://example.com",
      label: "official site",
      isPrimary: true,
      visibility: "public",
    },
  ],
};

const aiContentFailed = evaluateProjectPublishReadiness(baseDraft);
assert.notEqual(aiContentFailed.outcome, "blocked");
assert.equal(aiContentFailed.issues.length, 0);
assert.ok(aiContentFailed.warnings.some((warning) => warning.includes("AI 增强版内容生成失败")));

const noGithub = evaluateProjectPublishReadiness({
  ...baseDraft,
  id: "project_2",
  slug: "website-only-project",
  githubUrl: null,
  sources: [{ kind: "WEBSITE", url: "https://website-only.example", isPrimary: true, visibility: "public" }],
});
assert.notEqual(noGithub.outcome, "blocked");
assert.ok(noGithub.warnings.some((warning) => warning.includes("未绑定 GitHub")));

const nonDraft = evaluateProjectPublishReadiness({
  ...baseDraft,
  id: "project_3",
  status: "PUBLISHED",
  visibilityStatus: "PUBLISHED",
});
assert.equal(nonDraft.outcome, "skipped");

const officialFirst = resolveProjectInformation({
  ...baseDraft,
  officialInfo: {
    summary: "Official summary wins",
    fullDescription: "Official full description wins",
    website: "https://official.example",
  },
});
assert.equal(officialFirst.tagline, "Official summary wins");
assert.equal(officialFirst.provenance.tagline, "official");
assert.equal(officialFirst.description, "Official full description wins");
assert.equal(officialFirst.websiteUrl, "https://official.example");

const knowledgeFirst = resolveProjectInformation({
  ...baseDraft,
  tagline: null,
  description: null,
  primaryCategory: null,
  tags: [],
});
assert.equal(knowledgeFirst.provenance.tagline, "knowledge");
assert.equal(knowledgeFirst.provenance.description, "knowledge");
assert.equal(knowledgeFirst.provenance.primaryCategory, "knowledge");
assert.equal(knowledgeFirst.primaryCategory, "ai_agent");

const aiInsightWithoutKnowledge = evaluateProjectPublishReadiness({
  ...baseDraft,
  id: "project_4",
  slug: "ai-insight-without-knowledge",
  aiInsightStatus: "failed",
  aiKnowledgeJson: null,
  aiCardSummary: null,
  aiInsight: {
    summary: "AI insight exists even though status is stale",
  },
});
assert.notEqual(aiInsightWithoutKnowledge.outcome, "blocked");
assert.ok(aiInsightWithoutKnowledge.warnings.some((warning) => warning.includes("success")));

const nestedInsight = resolveProjectInformation({
  ...baseDraft,
  aiInsightStatus: null,
  aiKnowledgeJson: null,
  aiCardSummary: null,
  aiInsight: {
    insight: {
      whatItIs: "Nested insight payload from an older response shape",
    },
  },
});
assert.equal(nestedInsight.hasUsableKnowledge, true);
assert.equal(nestedInsight.knowledgeDiagnostics.hasAiInsightCoreFields, true);

const missingKnowledge = evaluateProjectPublishReadiness({
  ...baseDraft,
  id: "project_5",
  slug: "missing-ai-insight",
  aiInsightStatus: "pending",
  aiInsight: null,
  aiKnowledgeJson: null,
  aiCardSummary: null,
  aiSourceSnapshot: { base: { name: "only source snapshot" } },
});
assert.equal(missingKnowledge.outcome, "blocked");
assert.equal(missingKnowledge.knowledgeDiagnostics?.hasAiInsight, false);
assert.equal(missingKnowledge.knowledgeDiagnostics?.hasAiSourceSnapshot, true);

const legacyFallback = resolveProjectInformation({
  name: "Legacy Project",
  slug: "legacy-project",
  tagline: "Legacy English tagline",
  description: "Legacy description",
  primaryCategory: "productivity",
  tags: ["legacy"],
  aiInsight: null,
  aiInsightStatus: null,
  aiKnowledgeJson: null,
  aiCardSummary: null,
  sources: [],
});
assert.equal(legacyFallback.tagline, "Legacy English tagline");
assert.equal(legacyFallback.provenance.tagline, "legacy");
assert.equal(legacyFallback.primaryCategory, "productivity");
assert.deepEqual(legacyFallback.tags, ["legacy"]);

console.log("project information phase1 verification passed");
