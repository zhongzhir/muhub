-- AlterTable
ALTER TABLE "GithubRepoSnapshot" ADD COLUMN IF NOT EXISTS "repoPlatform" TEXT;
ALTER TABLE "GithubRepoSnapshot" ADD COLUMN IF NOT EXISTS "repoOwner" TEXT;
ALTER TABLE "GithubRepoSnapshot" ADD COLUMN IF NOT EXISTS "repoName" TEXT;
