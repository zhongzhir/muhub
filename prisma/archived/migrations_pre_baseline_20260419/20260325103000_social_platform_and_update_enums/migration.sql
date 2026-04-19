-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM (
  'WECHAT_OFFICIAL',
  'WECHAT_CHANNELS',
  'DOUYIN',
  'XIAOHONGSHU',
  'WEIBO',
  'BILIBILI',
  'X',
  'DISCORD',
  'REDDIT'
);

-- CreateEnum
CREATE TYPE "ProjectUpdateSourceType" AS ENUM ('MANUAL', 'GITHUB', 'SOCIAL', 'SYSTEM');

-- AlterTable: 新建项目默认「已发布」态，便于公开详情页展示
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- ProjectSocialAccount.platform: TEXT -> SocialPlatform
ALTER TABLE "ProjectSocialAccount" ADD COLUMN "platform_new" "SocialPlatform";

UPDATE "ProjectSocialAccount" SET "platform_new" = (
  CASE LOWER(TRIM("platform"))
    WHEN 'weibo' THEN 'WEIBO'::"SocialPlatform"
    WHEN 'wechat' THEN 'WECHAT_OFFICIAL'::"SocialPlatform"
    WHEN 'wechat_official' THEN 'WECHAT_OFFICIAL'::"SocialPlatform"
    WHEN 'douyin' THEN 'DOUYIN'::"SocialPlatform"
    WHEN 'xiaohongshu' THEN 'XIAOHONGSHU'::"SocialPlatform"
    WHEN 'wechat_channels' THEN 'WECHAT_CHANNELS'::"SocialPlatform"
    WHEN 'bilibili' THEN 'BILIBILI'::"SocialPlatform"
    WHEN 'discord' THEN 'DISCORD'::"SocialPlatform"
    WHEN 'reddit' THEN 'REDDIT'::"SocialPlatform"
    WHEN 'x' THEN 'X'::"SocialPlatform"
    ELSE 'WEIBO'::"SocialPlatform"
  END
);

ALTER TABLE "ProjectSocialAccount" DROP COLUMN "platform";
ALTER TABLE "ProjectSocialAccount" RENAME COLUMN "platform_new" TO "platform";
ALTER TABLE "ProjectSocialAccount" ALTER COLUMN "platform" SET NOT NULL;

-- ProjectUpdate.sourceType: TEXT -> ProjectUpdateSourceType
ALTER TABLE "ProjectUpdate" ADD COLUMN "sourceType_new" "ProjectUpdateSourceType";

UPDATE "ProjectUpdate" SET "sourceType_new" = (
  CASE LOWER(TRIM("sourceType"))
    WHEN 'github' THEN 'GITHUB'::"ProjectUpdateSourceType"
    WHEN 'social' THEN 'SOCIAL'::"ProjectUpdateSourceType"
    WHEN 'system' THEN 'SYSTEM'::"ProjectUpdateSourceType"
    WHEN 'manual' THEN 'MANUAL'::"ProjectUpdateSourceType"
    WHEN 'release' THEN 'GITHUB'::"ProjectUpdateSourceType"
    WHEN 'blog' THEN 'MANUAL'::"ProjectUpdateSourceType"
    ELSE 'MANUAL'::"ProjectUpdateSourceType"
  END
);

ALTER TABLE "ProjectUpdate" DROP COLUMN "sourceType";
ALTER TABLE "ProjectUpdate" RENAME COLUMN "sourceType_new" TO "sourceType";
ALTER TABLE "ProjectUpdate" ALTER COLUMN "sourceType" SET NOT NULL;
