-- Store Discovery feedback in the database. JSONL is now an export artifact,
-- not the runtime source of truth.
CREATE TABLE IF NOT EXISTS "DiscoveryFeedback" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "entityHintId" TEXT,
  "entityName" TEXT NOT NULL,
  "originalEntityType" TEXT,
  "finalEntityType" TEXT,
  "originalStatus" TEXT,
  "finalStatus" TEXT,
  "decision" TEXT NOT NULL,
  "reasonTags" JSONB,
  "comment" TEXT,
  "operator" TEXT,
  "sourceUrl" TEXT,
  "sourceTitle" TEXT,
  "isHumanDecision" BOOLEAN NOT NULL DEFAULT true,
  "decisionSource" TEXT,
  "authenticityScore" INTEGER,
  "metadata" JSONB,
  CONSTRAINT "DiscoveryFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DiscoveryFeedback_entityHintId_createdAt_idx"
  ON "DiscoveryFeedback"("entityHintId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "DiscoveryFeedback_decision_createdAt_idx"
  ON "DiscoveryFeedback"("decision", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "DiscoveryFeedback_isHumanDecision_createdAt_idx"
  ON "DiscoveryFeedback"("isHumanDecision", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "DiscoveryFeedback_decisionSource_createdAt_idx"
  ON "DiscoveryFeedback"("decisionSource", "createdAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DiscoveryFeedback_entityHintId_fkey'
  ) THEN
    ALTER TABLE "DiscoveryFeedback"
      ADD CONSTRAINT "DiscoveryFeedback_entityHintId_fkey"
      FOREIGN KEY ("entityHintId") REFERENCES "EntityHint"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
