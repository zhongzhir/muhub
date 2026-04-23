-- AlterTable
ALTER TABLE "Project"
ADD COLUMN     "aiContentDraft" JSONB,
ADD COLUMN     "aiContentDraftUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "aiContentDraftBy" TEXT;

-- CreateTable
CREATE TABLE "ProjectContentEditLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectContentEditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectContentEditLog_projectId_createdAt_idx" ON "ProjectContentEditLog"("projectId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ProjectContentEditLog" ADD CONSTRAINT "ProjectContentEditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
