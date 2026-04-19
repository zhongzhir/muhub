-- AlterTable
ALTER TABLE "GithubRepoSnapshot" ADD COLUMN IF NOT EXISTS "latestReleaseTag" TEXT;
ALTER TABLE "GithubRepoSnapshot" ADD COLUMN IF NOT EXISTS "latestReleaseAt" TIMESTAMP(3);
