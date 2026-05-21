-- Phase 4.1: Structured knowledge + source quality

CREATE TYPE "SourceTrustLevel" AS ENUM ('official', 'verified', 'inferred');
CREATE TYPE "SourceOwnershipLevel" AS ENUM ('official', 'third_party');
CREATE TYPE "SourceEntityAccuracy" AS ENUM ('exact', 'possible', 'weak');
CREATE TYPE "SourceVisibility" AS ENUM ('public', 'internal');
CREATE TYPE "SourceVerificationStatus" AS ENUM ('verified', 'pending', 'failed');

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "aiKnowledgeJson" JSONB;

ALTER TABLE "ProjectSource" ADD COLUMN IF NOT EXISTS "trustLevel" "SourceTrustLevel" NOT NULL DEFAULT 'inferred';
ALTER TABLE "ProjectSource" ADD COLUMN IF NOT EXISTS "ownershipLevel" "SourceOwnershipLevel" NOT NULL DEFAULT 'third_party';
ALTER TABLE "ProjectSource" ADD COLUMN IF NOT EXISTS "entityAccuracy" "SourceEntityAccuracy" NOT NULL DEFAULT 'possible';
ALTER TABLE "ProjectSource" ADD COLUMN IF NOT EXISTS "visibility" "SourceVisibility" NOT NULL DEFAULT 'public';
ALTER TABLE "ProjectSource" ADD COLUMN IF NOT EXISTS "verificationStatus" "SourceVerificationStatus" NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS "ProjectSource_projectId_visibility_idx" ON "ProjectSource"("projectId", "visibility");

-- Backfill: primary website/github as official public exact
UPDATE "ProjectSource"
SET
  "trustLevel" = 'official',
  "ownershipLevel" = 'official',
  "entityAccuracy" = 'exact',
  "visibility" = 'public',
  "verificationStatus" = 'verified'
WHERE "kind" IN ('GITHUB', 'GITEE', 'WEBSITE') AND "isPrimary" = true;

UPDATE "ProjectSource"
SET
  "trustLevel" = 'official',
  "ownershipLevel" = 'official',
  "entityAccuracy" = 'exact',
  "visibility" = 'public',
  "verificationStatus" = 'verified'
WHERE "kind" IN ('GITHUB', 'GITEE') AND "label" NOT LIKE 'enriched_%';

UPDATE "ProjectSource"
SET
  "visibility" = 'internal',
  "entityAccuracy" = 'weak',
  "trustLevel" = 'inferred',
  "verificationStatus" = 'failed'
WHERE "label" LIKE 'enriched_%'
  AND (
    "url" LIKE '%twitter.com/home%'
    OR "url" LIKE '%x.com/home%'
    OR "url" LIKE '%x.com/intent/%'
    OR "url" LIKE '%bilibili.com/%' AND "url" NOT LIKE '%/video/%'
    OR "url" LIKE '%apps.apple.com/%' AND "url" NOT LIKE '%/app/%'
    OR "url" LIKE '%chromewebstore.google.com/%' AND "url" NOT LIKE '%/detail/%'
  );
