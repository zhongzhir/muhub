-- AlterTable
ALTER TABLE "ProjectClaim" ADD COLUMN     "claimantName" TEXT,
ADD COLUMN     "claimantRole" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "contactWechat" TEXT,
ADD COLUMN     "message" TEXT,
ADD COLUMN     "organizationName" TEXT,
ADD COLUMN     "projectName" TEXT,
ADD COLUMN     "projectSlug" TEXT,
ADD COLUMN     "proofUrl" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "ProjectClaim_projectId_idx" ON "ProjectClaim"("projectId");

-- CreateIndex
CREATE INDEX "ProjectClaim_status_idx" ON "ProjectClaim"("status");

-- CreateIndex
CREATE INDEX "ProjectClaim_createdAt_idx" ON "ProjectClaim"("createdAt");
