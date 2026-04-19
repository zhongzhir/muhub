CREATE TYPE "DiscoveryCandidateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MERGED');

ALTER TABLE "DiscoveryCandidate"
ADD COLUMN "status" "DiscoveryCandidateStatus" NOT NULL DEFAULT 'PENDING';

UPDATE "DiscoveryCandidate"
SET "status" = CASE
  WHEN "reviewStatus" = 'APPROVED' THEN 'APPROVED'::"DiscoveryCandidateStatus"
  WHEN "reviewStatus" = 'REJECTED' THEN 'REJECTED'::"DiscoveryCandidateStatus"
  WHEN "reviewStatus" = 'MERGED' THEN 'MERGED'::"DiscoveryCandidateStatus"
  ELSE 'PENDING'::"DiscoveryCandidateStatus"
END;

ALTER TABLE "Project"
ADD COLUMN "publishedAt" TIMESTAMP(3);

ALTER TABLE "Project"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "ProjectStatus" RENAME TO "ProjectStatus_old";

CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'READY', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "Project"
ALTER COLUMN "status" TYPE "ProjectStatus"
USING (
  CASE
    WHEN "status"::text = 'ACTIVE' AND "visibilityStatus" = 'PUBLISHED' THEN 'PUBLISHED'
    WHEN "status"::text = 'ACTIVE' THEN 'READY'
    ELSE "status"::text
  END
)::"ProjectStatus";

ALTER TABLE "Project"
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

UPDATE "Project"
SET "publishedAt" = COALESCE("publishedAt", "updatedAt", "createdAt")
WHERE "visibilityStatus" = 'PUBLISHED';

DROP TYPE "ProjectStatus_old";
