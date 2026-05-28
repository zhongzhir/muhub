-- Entity Discovery E1.6: EntityHintFeedback (structured expert feedback)

CREATE TABLE IF NOT EXISTS "EntityHintFeedback" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entityHintId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reviewer" TEXT NOT NULL DEFAULT 'operator',
    "feedbackReason" TEXT,
    "feedbackTags" JSONB,
    "confidenceAdjustment" DOUBLE PRECISION,
    "isHighValue" BOOLEAN,
    "shouldTrackLongTerm" BOOLEAN,
    "notes" TEXT,

    CONSTRAINT "EntityHintFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EntityHintFeedback_entityHintId_createdAt_idx"
  ON "EntityHintFeedback"("entityHintId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "EntityHintFeedback_action_createdAt_idx"
  ON "EntityHintFeedback"("action", "createdAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EntityHintFeedback_entityHintId_fkey'
  ) THEN
    ALTER TABLE "EntityHintFeedback"
      ADD CONSTRAINT "EntityHintFeedback_entityHintId_fkey"
      FOREIGN KEY ("entityHintId") REFERENCES "EntityHint"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
