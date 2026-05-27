-- Vertical Discovery Phase 1: scope + loose AI structured profile fields (additive, nullable)

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "discoveryScopes" JSONB;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "aiStructuredProfileJson" JSONB;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "aiStructuredProfileStatus" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "aiStructuredProfileUpdatedAt" TIMESTAMP(3);

-- Backfill: default general scope for all existing projects
UPDATE "Project"
SET "discoveryScopes" = '["general"]'::jsonb
WHERE "discoveryScopes" IS NULL;

-- Backfill: publishing_media projects also get publishing_ai scope
UPDATE "Project"
SET "discoveryScopes" = '["general", "publishing_ai"]'::jsonb
WHERE "primaryCategory" = 'publishing_media'
  AND ("discoveryScopes" IS NULL OR "discoveryScopes" = '["general"]'::jsonb);
