-- Discovery V3：机构型来源 + DiscoverySource.type 枚举化

CREATE TYPE "DiscoverySourceType" AS ENUM ('GITHUB', 'PRODUCTHUNT', 'INSTITUTION');

ALTER TABLE "DiscoverySource" ADD COLUMN "institutionName" TEXT;
ALTER TABLE "DiscoverySource" ADD COLUMN "institutionType" TEXT;
ALTER TABLE "DiscoverySource" ADD COLUMN "institutionRegion" TEXT;

ALTER TABLE "DiscoverySource" ALTER COLUMN "type" TYPE "DiscoverySourceType" USING ("type"::"DiscoverySourceType");
