-- Phase 5 half: reference sources + simple summary
ALTER TYPE "DiscoverySourceType" ADD VALUE IF NOT EXISTS 'NEWS';
ALTER TYPE "DiscoverySourceType" ADD VALUE IF NOT EXISTS 'SOCIAL';
ALTER TYPE "DiscoverySourceType" ADD VALUE IF NOT EXISTS 'BLOG';

ALTER TABLE "DiscoveryCandidate"
ADD COLUMN IF NOT EXISTS "referenceSources" JSONB;

ALTER TABLE "Project"
ADD COLUMN IF NOT EXISTS "simpleSummary" TEXT,
ADD COLUMN IF NOT EXISTS "referenceSources" JSONB;
