-- AlterTable
ALTER TABLE "Project"
ADD COLUMN     "aiInsight" JSONB,
ADD COLUMN     "aiInsightStatus" TEXT,
ADD COLUMN     "aiInsightUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "aiInsightError" TEXT,
ADD COLUMN     "aiSignals" JSONB,
ADD COLUMN     "aiSuggestedTags" JSONB,
ADD COLUMN     "aiSuggestedCategories" JSONB,
ADD COLUMN     "aiCompleteness" JSONB,
ADD COLUMN     "aiSourceSnapshot" JSONB;
