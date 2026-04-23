-- AlterTable
ALTER TABLE "Project"
ADD COLUMN     "aiContent" JSONB,
ADD COLUMN     "aiContentStatus" TEXT,
ADD COLUMN     "aiContentUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "aiContentError" TEXT;
