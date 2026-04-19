-- Discovery V2：候选池、抓取来源与运行审计、项目外链与溯源字段

-- CreateEnum
CREATE TYPE "DiscoverySourceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "DiscoveryRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "DiscoveryEnrichmentStatus" AS ENUM ('PENDING', 'OK', 'FAILED');

-- CreateEnum
CREATE TYPE "DiscoveryReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MERGED');

-- CreateEnum
CREATE TYPE "DiscoveryImportStatus" AS ENUM ('PENDING', 'IMPORTED', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "DiscoverySource" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "status" "DiscoverySourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "configJson" JSONB,
    "scheduleCron" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoverySource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "DiscoveryRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "parsedCount" INTEGER NOT NULL DEFAULT 0,
    "newCandidateCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCandidateCount" INTEGER NOT NULL DEFAULT 0,
    "importedProjectCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "logJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveryRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryCandidate" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "discoveryRunId" TEXT,
    "externalType" TEXT NOT NULL,
    "externalId" TEXT,
    "externalUrl" TEXT,
    "sourceKey" TEXT,
    "normalizedKey" TEXT,
    "dedupeHash" TEXT,
    "title" TEXT NOT NULL,
    "slugCandidate" TEXT,
    "summary" TEXT,
    "descriptionRaw" TEXT,
    "website" TEXT,
    "repoUrl" TEXT,
    "docsUrl" TEXT,
    "twitterUrl" TEXT,
    "wechatUrl" TEXT,
    "douyinUrl" TEXT,
    "xiaohongshuUrl" TEXT,
    "youtubeUrl" TEXT,
    "language" TEXT,
    "openSourceLicense" TEXT,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "forks" INTEGER NOT NULL DEFAULT 0,
    "watchers" INTEGER NOT NULL DEFAULT 0,
    "issues" INTEGER NOT NULL DEFAULT 0,
    "lastCommitAt" TIMESTAMP(3),
    "repoCreatedAt" TIMESTAMP(3),
    "repoUpdatedAt" TIMESTAMP(3),
    "ownerName" TEXT,
    "ownerUrl" TEXT,
    "avatarUrl" TEXT,
    "categoriesJson" JSONB,
    "tagsJson" JSONB,
    "metadataJson" JSONB,
    "rawPayloadJson" JSONB,
    "enrichmentStatus" "DiscoveryEnrichmentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewStatus" "DiscoveryReviewStatus" NOT NULL DEFAULT 'PENDING',
    "importStatus" "DiscoveryImportStatus" NOT NULL DEFAULT 'PENDING',
    "matchedProjectId" TEXT,
    "score" DOUBLE PRECISION,
    "qualityScore" DOUBLE PRECISION,
    "popularityScore" DOUBLE PRECISION,
    "freshnessScore" DOUBLE PRECISION,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectExternalLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectExternalLink_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "discoverySource" TEXT,
ADD COLUMN     "discoverySourceId" TEXT,
ADD COLUMN     "discoveredAt" TIMESTAMP(3),
ADD COLUMN     "importedFromCandidateId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DiscoverySource_key_key" ON "DiscoverySource"("key");

-- CreateIndex
CREATE INDEX "DiscoverySource_type_status_idx" ON "DiscoverySource"("type", "status");

-- CreateIndex
CREATE INDEX "DiscoveryRun_sourceId_startedAt_idx" ON "DiscoveryRun"("sourceId", "startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryCandidate_normalizedKey_key" ON "DiscoveryCandidate"("normalizedKey");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryCandidate_dedupeHash_key" ON "DiscoveryCandidate"("dedupeHash");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_sourceId_lastSeenAt_idx" ON "DiscoveryCandidate"("sourceId", "lastSeenAt" DESC);

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_reviewStatus_importStatus_idx" ON "DiscoveryCandidate"("reviewStatus", "importStatus");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_repoUrl_idx" ON "DiscoveryCandidate"("repoUrl");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_matchedProjectId_idx" ON "DiscoveryCandidate"("matchedProjectId");

-- CreateIndex
CREATE INDEX "ProjectExternalLink_projectId_idx" ON "ProjectExternalLink"("projectId");

-- CreateIndex
CREATE INDEX "ProjectExternalLink_platform_projectId_idx" ON "ProjectExternalLink"("platform", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_importedFromCandidateId_key" ON "Project"("importedFromCandidateId");

-- AddForeignKey
ALTER TABLE "DiscoveryRun" ADD CONSTRAINT "DiscoveryRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DiscoverySource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryCandidate" ADD CONSTRAINT "DiscoveryCandidate_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DiscoverySource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryCandidate" ADD CONSTRAINT "DiscoveryCandidate_discoveryRunId_fkey" FOREIGN KEY ("discoveryRunId") REFERENCES "DiscoveryRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryCandidate" ADD CONSTRAINT "DiscoveryCandidate_matchedProjectId_fkey" FOREIGN KEY ("matchedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryCandidate" ADD CONSTRAINT "DiscoveryCandidate_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExternalLink" ADD CONSTRAINT "ProjectExternalLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_importedFromCandidateId_fkey" FOREIGN KEY ("importedFromCandidateId") REFERENCES "DiscoveryCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
