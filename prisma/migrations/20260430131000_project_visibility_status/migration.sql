-- CreateEnum
CREATE TYPE "ProjectVisibilityStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "visibilityStatus" "ProjectVisibilityStatus" NOT NULL DEFAULT 'DRAFT';

-- 兼容回填：历史上「公开」≈ isPublic=true → PUBLISHED
UPDATE "Project"
SET "visibilityStatus" = 'PUBLISHED', "isPublic" = true
WHERE "isPublic" = true AND "deletedAt" IS NULL;

-- 未公开且未删除 → 草稿
UPDATE "Project"
SET "visibilityStatus" = 'DRAFT', "isPublic" = false
WHERE "isPublic" = false AND "deletedAt" IS NULL;

-- 新建默认不进入广场
ALTER TABLE "Project" ALTER COLUMN "isPublic" SET DEFAULT false;
