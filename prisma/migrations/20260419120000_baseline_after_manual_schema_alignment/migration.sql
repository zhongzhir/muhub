-- Baseline: migration governance (2026-04). Full DDL from `schema.prisma` via `migrate diff --from-empty`.
-- Production: mark applied with `prisma migrate resolve --applied 20260419120000_baseline_after_manual_schema_alignment` (do not re-run if DB already matches).
-- See: docs/prisma-migration-governance.md

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'READY', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DiscoveryCandidateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MERGED');

-- CreateEnum
CREATE TYPE "ProjectVisibilityStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('WECHAT_OFFICIAL', 'WECHAT_CHANNELS', 'DOUYIN', 'XIAOHONGSHU', 'WEIBO', 'BILIBILI', 'X', 'DISCORD', 'REDDIT');

-- CreateEnum
CREATE TYPE "ProjectUpdateSourceType" AS ENUM ('MANUAL', 'GITHUB', 'SOCIAL', 'SYSTEM', 'OFFICIAL', 'AI', 'WEBSITE', 'BLOG', 'DOCS');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('UNCLAIMED', 'CLAIMED');

-- CreateEnum
CREATE TYPE "ProjectNotificationEventType" AS ENUM ('UPDATE_POSTED');

-- CreateEnum
CREATE TYPE "DiscoveredProjectCandidateStatus" AS ENUM ('pending', 'imported', 'discarded');

-- CreateEnum
CREATE TYPE "ProjectSourceKind" AS ENUM ('GITHUB', 'GITEE', 'WEBSITE', 'DOCS', 'BLOG', 'TWITTER', 'WECHAT', 'XIAOHONGSHU', 'DOUYIN', 'ZHIHU', 'BILIBILI', 'DISCORD', 'OTHER');

-- CreateEnum
CREATE TYPE "DiscoverySourceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "DiscoverySourceType" AS ENUM ('GITHUB', 'PRODUCTHUNT', 'INSTITUTION');

-- CreateEnum
CREATE TYPE "DiscoveryRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "DiscoveryEnrichmentStatus" AS ENUM ('PENDING', 'OK', 'FAILED');

-- CreateEnum
CREATE TYPE "DiscoveryEnrichmentJobStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "DiscoveryClassificationStatus" AS ENUM ('PENDING', 'DONE', 'FAILED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "DiscoveryClassificationJobStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "DiscoveryReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'IGNORED', 'MERGED');

-- CreateEnum
CREATE TYPE "DiscoveryImportStatus" AS ENUM ('PENDING', 'IMPORTED', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoverySource" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DiscoverySourceType" NOT NULL,
    "subtype" TEXT,
    "institutionName" TEXT,
    "institutionType" TEXT,
    "institutionRegion" TEXT,
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
    "suggestedType" TEXT,
    "suggestedTagsJson" JSONB,
    "classificationStatus" "DiscoveryClassificationStatus" NOT NULL DEFAULT 'PENDING',
    "classificationScore" DOUBLE PRECISION,
    "classificationEvidenceJson" JSONB,
    "isAiRelated" BOOLEAN,
    "isChineseTool" BOOLEAN,
    "enrichmentStatus" "DiscoveryEnrichmentStatus" NOT NULL DEFAULT 'PENDING',
    "status" "DiscoveryCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "reviewStatus" "DiscoveryReviewStatus" NOT NULL DEFAULT 'PENDING',
    "importStatus" "DiscoveryImportStatus" NOT NULL DEFAULT 'PENDING',
    "matchedProjectId" TEXT,
    "score" DOUBLE PRECISION,
    "qualityScore" DOUBLE PRECISION,
    "popularityScore" DOUBLE PRECISION,
    "freshnessScore" DOUBLE PRECISION,
    "reviewPriorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewPrioritySignals" JSONB,
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "DiscoveredProjectCandidate" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerName" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "homepageUrl" TEXT,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "primaryLanguage" TEXT,
    "lastPushedAt" TIMESTAMP(3),
    "isChineseRelated" BOOLEAN NOT NULL DEFAULT false,
    "status" "DiscoveredProjectCandidateStatus" NOT NULL DEFAULT 'pending',
    "rawPayload" JSONB,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveredProjectCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "PhoneVerificationCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "verifyAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneVerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoriesJson" JSONB,
    "primaryCategory" TEXT,
    "isAiRelated" BOOLEAN,
    "isChineseTool" BOOLEAN,
    "aiCardSummary" TEXT,
    "aiStatus" TEXT,
    "aiUpdatedAt" TIMESTAMP(3),
    "aiError" TEXT,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "githubUrl" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sourceType" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "visibilityStatus" "ProjectVisibilityStatus" NOT NULL DEFAULT 'DRAFT',
    "claimStatus" "ClaimStatus" NOT NULL DEFAULT 'UNCLAIMED',
    "claimedAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "createdById" TEXT,
    "claimedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "discoverySource" TEXT,
    "discoverySourceId" TEXT,
    "discoveredAt" TIMESTAMP(3),
    "importedFromCandidateId" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLike" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFollow" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectWeeklySummary" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectWeeklySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSource" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ProjectSourceKind" NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSocialAccount" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectUpdate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceType" "ProjectUpdateSourceType" NOT NULL,
    "sourceLabel" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "sourceUrl" TEXT,
    "metaJson" TEXT,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectNotificationEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "ProjectNotificationEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sourceUpdateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectNotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectNotificationEventId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubRepoSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "repoPlatform" TEXT,
    "repoOwner" TEXT,
    "repoName" TEXT,
    "repoFullName" TEXT NOT NULL,
    "defaultBranch" TEXT,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "forks" INTEGER NOT NULL DEFAULT 0,
    "openIssues" INTEGER NOT NULL DEFAULT 0,
    "watchers" INTEGER NOT NULL DEFAULT 0,
    "commitCount7d" INTEGER NOT NULL DEFAULT 0,
    "commitCount30d" INTEGER NOT NULL DEFAULT 0,
    "contributorsCount" INTEGER NOT NULL DEFAULT 0,
    "lastCommitAt" TIMESTAMP(3),
    "latestReleaseTag" TEXT,
    "latestReleaseAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GithubRepoSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

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
CREATE INDEX "DiscoveryCandidate_suggestedType_idx" ON "DiscoveryCandidate"("suggestedType");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_isAiRelated_idx" ON "DiscoveryCandidate"("isAiRelated");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_isChineseTool_idx" ON "DiscoveryCandidate"("isChineseTool");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_classificationStatus_idx" ON "DiscoveryCandidate"("classificationStatus");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_status_idx" ON "DiscoveryCandidate"("status");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_reviewStatus_importStatus_idx" ON "DiscoveryCandidate"("reviewStatus", "importStatus");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_reviewStatus_reviewPriorityScore_idx" ON "DiscoveryCandidate"("reviewStatus", "reviewPriorityScore" DESC);

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_repoUrl_idx" ON "DiscoveryCandidate"("repoUrl");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_matchedProjectId_idx" ON "DiscoveryCandidate"("matchedProjectId");

-- CreateIndex
CREATE INDEX "DiscoveryEnrichmentJob_candidateId_startedAt_idx" ON "DiscoveryEnrichmentJob"("candidateId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "DiscoveryClassificationJob_candidateId_startedAt_idx" ON "DiscoveryClassificationJob"("candidateId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "DiscoveryEnrichmentLink_candidateId_idx" ON "DiscoveryEnrichmentLink"("candidateId");

-- CreateIndex
CREATE INDEX "DiscoveryEnrichmentLink_jobId_idx" ON "DiscoveryEnrichmentLink"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryEnrichmentLink_candidateId_normalizedUrl_key" ON "DiscoveryEnrichmentLink"("candidateId", "normalizedUrl");

-- CreateIndex
CREATE INDEX "ProjectExternalLink_projectId_idx" ON "ProjectExternalLink"("projectId");

-- CreateIndex
CREATE INDEX "ProjectExternalLink_platform_projectId_idx" ON "ProjectExternalLink"("platform", "projectId");

-- CreateIndex
CREATE INDEX "DiscoveredProjectCandidate_status_discoveredAt_idx" ON "DiscoveredProjectCandidate"("status", "discoveredAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveredProjectCandidate_source_sourceId_key" ON "DiscoveredProjectCandidate"("source", "sourceId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "PhoneVerificationCode_phone_purpose_createdAt_idx" ON "PhoneVerificationCode"("phone", "purpose", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_importedFromCandidateId_key" ON "Project"("importedFromCandidateId");

-- CreateIndex
CREATE INDEX "Project_createdById_idx" ON "Project"("createdById");

-- CreateIndex
CREATE INDEX "Project_claimedByUserId_idx" ON "Project"("claimedByUserId");

-- CreateIndex
CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");

-- CreateIndex
CREATE INDEX "Project_primaryCategory_idx" ON "Project"("primaryCategory");

-- CreateIndex
CREATE INDEX "Project_isAiRelated_idx" ON "Project"("isAiRelated");

-- CreateIndex
CREATE INDEX "Project_isChineseTool_idx" ON "Project"("isChineseTool");

-- CreateIndex
CREATE INDEX "ProjectLike_userId_idx" ON "ProjectLike"("userId");

-- CreateIndex
CREATE INDEX "ProjectLike_projectId_idx" ON "ProjectLike"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLike_projectId_userId_key" ON "ProjectLike"("projectId", "userId");

-- CreateIndex
CREATE INDEX "ProjectFollow_userId_idx" ON "ProjectFollow"("userId");

-- CreateIndex
CREATE INDEX "ProjectFollow_projectId_idx" ON "ProjectFollow"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectFollow_projectId_userId_key" ON "ProjectFollow"("projectId", "userId");

-- CreateIndex
CREATE INDEX "ProjectWeeklySummary_projectId_idx" ON "ProjectWeeklySummary"("projectId");

-- CreateIndex
CREATE INDEX "ProjectWeeklySummary_projectId_createdAt_idx" ON "ProjectWeeklySummary"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProjectSource_projectId_idx" ON "ProjectSource"("projectId");

-- CreateIndex
CREATE INDEX "ProjectSocialAccount_projectId_idx" ON "ProjectSocialAccount"("projectId");

-- CreateIndex
CREATE INDEX "ProjectUpdate_projectId_idx" ON "ProjectUpdate"("projectId");

-- CreateIndex
CREATE INDEX "ProjectNotificationEvent_projectId_idx" ON "ProjectNotificationEvent"("projectId");

-- CreateIndex
CREATE INDEX "ProjectNotificationEvent_projectId_createdAt_idx" ON "ProjectNotificationEvent"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProjectNotificationEvent_sourceUpdateId_idx" ON "ProjectNotificationEvent"("sourceUpdateId");

-- CreateIndex
CREATE INDEX "UserNotification_userId_idx" ON "UserNotification"("userId");

-- CreateIndex
CREATE INDEX "UserNotification_userId_readAt_idx" ON "UserNotification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "UserNotification_projectId_idx" ON "UserNotification"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "UserNotification_userId_projectNotificationEventId_key" ON "UserNotification"("userId", "projectNotificationEventId");

-- CreateIndex
CREATE INDEX "GithubRepoSnapshot_projectId_idx" ON "GithubRepoSnapshot"("projectId");

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
ALTER TABLE "DiscoveryEnrichmentJob" ADD CONSTRAINT "DiscoveryEnrichmentJob_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "DiscoveryCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryClassificationJob" ADD CONSTRAINT "DiscoveryClassificationJob_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "DiscoveryCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryEnrichmentLink" ADD CONSTRAINT "DiscoveryEnrichmentLink_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "DiscoveryCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryEnrichmentLink" ADD CONSTRAINT "DiscoveryEnrichmentLink_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DiscoveryEnrichmentJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExternalLink" ADD CONSTRAINT "ProjectExternalLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_importedFromCandidateId_fkey" FOREIGN KEY ("importedFromCandidateId") REFERENCES "DiscoveryCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLike" ADD CONSTRAINT "ProjectLike_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLike" ADD CONSTRAINT "ProjectLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFollow" ADD CONSTRAINT "ProjectFollow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFollow" ADD CONSTRAINT "ProjectFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWeeklySummary" ADD CONSTRAINT "ProjectWeeklySummary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSource" ADD CONSTRAINT "ProjectSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSocialAccount" ADD CONSTRAINT "ProjectSocialAccount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUpdate" ADD CONSTRAINT "ProjectUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectNotificationEvent" ADD CONSTRAINT "ProjectNotificationEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectNotificationEvent" ADD CONSTRAINT "ProjectNotificationEvent_sourceUpdateId_fkey" FOREIGN KEY ("sourceUpdateId") REFERENCES "ProjectUpdate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_projectNotificationEventId_fkey" FOREIGN KEY ("projectNotificationEventId") REFERENCES "ProjectNotificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubRepoSnapshot" ADD CONSTRAINT "GithubRepoSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
