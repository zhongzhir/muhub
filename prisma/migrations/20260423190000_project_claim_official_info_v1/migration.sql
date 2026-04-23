-- CreateTable
CREATE TABLE "ProjectClaim" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectOfficialInfo" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "summary" TEXT,
    "fullDescription" TEXT,
    "useCases" JSONB,
    "whoFor" JSONB,
    "website" TEXT,
    "twitter" TEXT,
    "discord" TEXT,
    "contactEmail" TEXT,
    "teamInfo" JSONB,
    "businessInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectOfficialInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectClaim_projectId_createdAt_idx" ON "ProjectClaim"("projectId", "createdAt" DESC);
CREATE INDEX "ProjectClaim_userId_createdAt_idx" ON "ProjectClaim"("userId", "createdAt" DESC);
CREATE UNIQUE INDEX "ProjectOfficialInfo_projectId_key" ON "ProjectOfficialInfo"("projectId");
CREATE INDEX "ProjectOfficialInfo_ownerId_updatedAt_idx" ON "ProjectOfficialInfo"("ownerId", "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "ProjectClaim" ADD CONSTRAINT "ProjectClaim_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectOfficialInfo" ADD CONSTRAINT "ProjectOfficialInfo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
