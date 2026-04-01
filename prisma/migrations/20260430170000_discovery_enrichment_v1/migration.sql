-- Discovery V2 Enrichment V1：任务与抽取外链表

CREATE TYPE "DiscoveryEnrichmentJobStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

CREATE TABLE "DiscoveryEnrichmentJob" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'enrichment-v1',
    "status" "DiscoveryEnrichmentJobStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "extractedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "logJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveryEnrichmentJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscoveryEnrichmentLink" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobId" TEXT,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "host" TEXT,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isAccepted" BOOLEAN NOT NULL DEFAULT false,
    "evidenceText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryEnrichmentLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiscoveryEnrichmentJob_candidateId_startedAt_idx" ON "DiscoveryEnrichmentJob"("candidateId", "startedAt" DESC);

CREATE UNIQUE INDEX "DiscoveryEnrichmentLink_candidateId_normalizedUrl_key" ON "DiscoveryEnrichmentLink"("candidateId", "normalizedUrl");

CREATE INDEX "DiscoveryEnrichmentLink_candidateId_idx" ON "DiscoveryEnrichmentLink"("candidateId");

CREATE INDEX "DiscoveryEnrichmentLink_jobId_idx" ON "DiscoveryEnrichmentLink"("jobId");

ALTER TABLE "DiscoveryEnrichmentJob" ADD CONSTRAINT "DiscoveryEnrichmentJob_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "DiscoveryCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscoveryEnrichmentLink" ADD CONSTRAINT "DiscoveryEnrichmentLink_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "DiscoveryCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscoveryEnrichmentLink" ADD CONSTRAINT "DiscoveryEnrichmentLink_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DiscoveryEnrichmentJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
