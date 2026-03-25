-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('UNCLAIMED', 'CLAIMED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "claimStatus" "ClaimStatus" NOT NULL DEFAULT 'UNCLAIMED';
ALTER TABLE "Project" ADD COLUMN "claimedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "claimedBy" TEXT;
