-- AlterEnum
ALTER TYPE "ProjectUpdateSourceType" ADD VALUE 'OFFICIAL';
ALTER TYPE "ProjectUpdateSourceType" ADD VALUE 'AI';

-- AlterTable
ALTER TABLE "ProjectUpdate" ADD COLUMN "sourceLabel" TEXT;
ALTER TABLE "ProjectUpdate" ADD COLUMN "metaJson" TEXT;
ALTER TABLE "ProjectUpdate" ADD COLUMN "isAiGenerated" BOOLEAN NOT NULL DEFAULT false;
