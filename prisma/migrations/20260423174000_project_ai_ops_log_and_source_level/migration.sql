-- AlterTable
ALTER TABLE "Project"
ADD COLUMN     "aiSourceLevel" TEXT;

-- CreateTable
CREATE TABLE "ProjectAiOpsLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "operatorEmail" TEXT,
    "action" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "appliedItems" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAiOpsLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectAiOpsLog_projectId_createdAt_idx" ON "ProjectAiOpsLog"("projectId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ProjectAiOpsLog" ADD CONSTRAINT "ProjectAiOpsLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
