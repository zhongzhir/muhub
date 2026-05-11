import { validateProjectForPublish } from "../lib/admin-project-edit";
import { getProjectSources } from "../lib/project-sources";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function verifyPublishValidationWithoutGithub(): void {
  const valid = validateProjectForPublish({
    name: "E2E Non GitHub Project",
    tagline: "测试无 GitHub 项目",
    description: "测试无 GitHub 项目",
    primaryCategory: null,
    tags: [],
    websiteUrl: "https://example.com/non-github-project",
    githubUrl: null,
    aiCardSummary: null,
    externalLinks: [],
  });

  assert(valid.ok, "发布校验应允许无 GitHub 项目在有公开来源时通过");
  assert(
    !valid.blockingErrors.some((msg) => /github/i.test(msg)),
    "发布校验阻塞项不应包含 GitHub 必填",
  );

  const invalid = validateProjectForPublish({
    name: "E2E Non GitHub Project",
    tagline: "",
    description: "",
    primaryCategory: null,
    tags: [],
    websiteUrl: null,
    githubUrl: null,
    aiCardSummary: null,
    externalLinks: [],
  });
  assert(!invalid.ok, "缺少介绍与公开来源时应阻塞发布");

  const validWithAppStoreSource = validateProjectForPublish(
    {
      name: "HakkoAI",
      tagline: "游戏场景 AI 陪伴产品",
      description: null,
      primaryCategory: null,
      tags: [],
      websiteUrl: null,
      githubUrl: null,
      aiCardSummary: null,
      externalLinks: [],
    },
    [
      {
        kind: "OTHER",
        url: "https://apps.apple.com/cn/app/id6477382934",
      },
    ],
  );
  assert(validWithAppStoreSource.ok, "App Store / Google Play 等 ProjectSource 应计入公开来源");

  const invalidWithOnlyArticleSource = validateProjectForPublish(
    {
      name: "Article Only Project",
      tagline: "只有来源文章，没有项目入口",
      description: null,
      primaryCategory: null,
      tags: [],
      websiteUrl: null,
      githubUrl: null,
      aiCardSummary: null,
      externalLinks: [],
    },
    [
      {
        kind: "WECHAT_ARTICLE",
        url: "https://mp.weixin.qq.com/s/example",
      },
    ],
  );
  assert(!invalidWithOnlyArticleSource.ok, "来源文章不应单独替代项目公开入口");
}

function verifyPublicSourceBuilderWithNullGithub(): void {
  const sources = getProjectSources({
    legacyGithubUrl: null,
    legacyWebsiteUrl: "https://example.com/non-github-project",
    rows: [],
  });

  assert(sources.length === 1, "无 GitHub 且有官网时应正常构建来源列表");
  assert(sources[0]?.kind === "WEBSITE", "来源列表首项应为 WEBSITE");
}

function main(): void {
  verifyPublishValidationWithoutGithub();
  verifyPublicSourceBuilderWithNullGithub();
  console.log("verify-non-github-project-flow: ok");
}

main();
