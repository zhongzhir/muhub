ALTER TYPE "ProjectSourceKind" ADD VALUE 'WECHAT_ARTICLE';

ALTER TABLE "ProjectSource"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "content" TEXT,
  ADD COLUMN "summary" TEXT;
