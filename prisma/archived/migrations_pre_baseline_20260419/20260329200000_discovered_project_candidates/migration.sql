-- CreateEnum
CREATE TYPE "DiscoveredProjectCandidateStatus" AS ENUM ('pending', 'imported', 'discarded');

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

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveredProjectCandidate_source_sourceId_key" ON "DiscoveredProjectCandidate"("source", "sourceId");

-- CreateIndex
CREATE INDEX "DiscoveredProjectCandidate_status_discoveredAt_idx" ON "DiscoveredProjectCandidate"("status", "discoveredAt" DESC);
