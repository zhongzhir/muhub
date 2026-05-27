-- Phase 2.5: Source Network MVP (additive)

ALTER TYPE "DiscoverySourceStatus" ADD VALUE IF NOT EXISTS 'TESTING';

ALTER TABLE "DiscoverySource" ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE "DiscoverySignal" ADD COLUMN IF NOT EXISTS "metadataJson" JSONB;
