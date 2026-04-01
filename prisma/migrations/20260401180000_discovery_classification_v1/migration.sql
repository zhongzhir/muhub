-- Discovery V2：规则分类 V1（候选建议类型/标签 + 任务表）

CREATE TYPE "DiscoveryClassificationStatus" AS ENUM ('PENDING', 'DONE', 'FAILED', 'ACCEPTED');
CREATE TYPE "DiscoveryClassificationJobStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

ALTER TABLE "DiscoveryCandidate" ADD COLUMN "suggestedType" TEXT;
ALTER TABLE "DiscoveryCandidate" ADD COLUMN "suggestedTagsJson" JSONB;
ALTER TABLE "DiscoveryCandidate" ADD COLUMN "classificationStatus" "DiscoveryClassificationStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "DiscoveryCandidate" ADD COLUMN "classificationScore" DOUBLE PRECISION;
ALTER TABLE "DiscoveryCandidate" ADD COLUMN "classificationEvidenceJson" JSONB;
ALTER TABLE "DiscoveryCandidate" ADD COLUMN "isAiRelated" BOOLEAN;
ALTER TABLE "DiscoveryCandidate" ADD COLUMN "isChineseTool" BOOLEAN;

CREATE TABLE "DiscoveryClassificationJob" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "status" "DiscoveryClassificationJobStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "logJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveryClassificationJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiscoveryClassificationJob_candidateId_startedAt_idx" ON "DiscoveryClassificationJob"("candidateId", "startedAt" DESC);

CREATE INDEX "DiscoveryCandidate_suggestedType_idx" ON "DiscoveryCandidate"("suggestedType");
CREATE INDEX "DiscoveryCandidate_isAiRelated_idx" ON "DiscoveryCandidate"("isAiRelated");
CREATE INDEX "DiscoveryCandidate_isChineseTool_idx" ON "DiscoveryCandidate"("isChineseTool");
CREATE INDEX "DiscoveryCandidate_classificationStatus_idx" ON "DiscoveryCandidate"("classificationStatus");

ALTER TABLE "DiscoveryClassificationJob" ADD CONSTRAINT "DiscoveryClassificationJob_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "DiscoveryCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
