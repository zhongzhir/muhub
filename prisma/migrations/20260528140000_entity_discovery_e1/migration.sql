-- Entity Discovery E1: EntityHint table (additive)

CREATE TABLE IF NOT EXISTS "EntityHint" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "discoveryScopes" JSONB,
    "sourceSignalId" TEXT,
    "sourceUrl" TEXT,
    "sourceTitle" TEXT,
    "sourceTextSnippet" TEXT,
    "evidenceJson" JSONB,
    "confidence" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "dedupeKey" TEXT NOT NULL,

    CONSTRAINT "EntityHint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EntityHint_dedupeKey_key" ON "EntityHint"("dedupeKey");
CREATE INDEX IF NOT EXISTS "EntityHint_entityType_status_idx" ON "EntityHint"("entityType", "status");
CREATE INDEX IF NOT EXISTS "EntityHint_status_createdAt_idx" ON "EntityHint"("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "EntityHint_sourceSignalId_idx" ON "EntityHint"("sourceSignalId");
CREATE INDEX IF NOT EXISTS "EntityHint_normalizedName_idx" ON "EntityHint"("normalizedName");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EntityHint_sourceSignalId_fkey'
  ) THEN
    ALTER TABLE "EntityHint"
      ADD CONSTRAINT "EntityHint_sourceSignalId_fkey"
      FOREIGN KEY ("sourceSignalId") REFERENCES "DiscoverySignal"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
