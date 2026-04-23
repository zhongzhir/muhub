-- AlterTable
ALTER TABLE "Project" ADD COLUMN "aiContentDraftStatus" TEXT;
ALTER TABLE "Project" ADD COLUMN "aiContentDraftStatusUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProjectContentEditLog" ADD COLUMN "editKind" TEXT;
