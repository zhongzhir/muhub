-- Discovery V2：审核优先级（规则分，供列表排序与运营视图）
ALTER TABLE "DiscoveryCandidate" ADD COLUMN "reviewPriorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DiscoveryCandidate" ADD COLUMN "reviewPrioritySignals" JSONB;

CREATE INDEX "DiscoveryCandidate_reviewStatus_reviewPriorityScore_idx" ON "DiscoveryCandidate" ("reviewStatus", "reviewPriorityScore" DESC);
