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

console.log("project information phase1 verification passed");
