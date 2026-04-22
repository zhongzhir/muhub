-- Discovery Signal layer
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiscoverySignalStatus') THEN
    CREATE TYPE "DiscoverySignalStatus" AS ENUM ('PENDING', 'REVIEWED', 'CONVERTED', 'REJECTED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "DiscoverySignal" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "sourceType" "DiscoverySourceType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "signalType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "url" TEXT NOT NULL,
  "rawText" TEXT,
  "referenceSources" JSONB,
  "guessedProjectName" TEXT,
  "guessedWebsiteUrl" TEXT,
  "guessedGithubUrl" TEXT,
  "status" "DiscoverySignalStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote" TEXT,
  "convertedCandidateId" TEXT,
  CONSTRAINT "DiscoverySignal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DiscoverySignal_url_key" ON "DiscoverySignal"("url");
CREATE INDEX IF NOT EXISTS "DiscoverySignal_sourceType_status_createdAt_idx" ON "DiscoverySignal"("sourceType", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "DiscoverySignal_sourceId_createdAt_idx" ON "DiscoverySignal"("sourceId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "DiscoverySignal_convertedCandidateId_idx" ON "DiscoverySignal"("convertedCandidateId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DiscoverySignal_sourceId_fkey'
  ) THEN
    ALTER TABLE "DiscoverySignal"
      ADD CONSTRAINT "DiscoverySignal_sourceId_fkey"
      FOREIGN KEY ("sourceId") REFERENCES "DiscoverySource"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DiscoverySignal_convertedCandidateId_fkey'
  ) THEN
    ALTER TABLE "DiscoverySignal"
      ADD CONSTRAINT "DiscoverySignal_convertedCandidateId_fkey"
      FOREIGN KEY ("convertedCandidateId") REFERENCES "DiscoveryCandidate"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
