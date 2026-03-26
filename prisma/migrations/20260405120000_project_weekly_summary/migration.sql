-- CreateTable
CREATE TABLE "ProjectWeeklySummary" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectWeeklySummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectWeeklySummary_projectId_idx" ON "ProjectWeeklySummary"("projectId");

-- CreateIndex
CREATE INDEX "ProjectWeeklySummary_projectId_createdAt_idx" ON "ProjectWeeklySummary"("projectId" ASC, "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ProjectWeeklySummary" ADD CONSTRAINT "ProjectWeeklySummary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
