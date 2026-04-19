-- Project：AI enrichment 状态（与 Prisma schema 中 aiStatus / aiUpdatedAt / aiError 对齐）
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "aiStatus" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "aiUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "aiError" TEXT;
