import { test, expect } from "@playwright/test";
import {
  extractGithubRepoUrlsFromText,
  firstGithubRepoUrlFromText,
  normalizeGithubRepoUrl,
} from "@/lib/discovery/normalize-url";
import { parseRepoUrl } from "@/lib/repo-platform";
import { computeProjectSourceLevel, type ProjectInsightSourceSnapshot } from "@/lib/project-ai-insight";
import { getProjectSources } from "@/lib/project-sources";
import {
  detectProjectSource,
  extractProjectSourceUrlsFromText,
  parseProjectSourceUrl,
} from "@/lib/project-source-url";

test.describe("多平台仓库 URL 解析", () => {
  test("GitHub URL 解析为 owner / repo", () => {
    expect(parseRepoUrl("https://github.com/vercel/next.js")).toEqual({
      platform: "github",
      owner: "vercel",
      repo: "next.js",
    });
  });

  test("无协议头与 www GitHub URL 也能解析", () => {
    expect(parseRepoUrl("github.com/SuperManito/LinuxMirrors")).toEqual({
      platform: "github",
      owner: "SuperManito",
      repo: "LinuxMirrors",
    });
    expect(parseRepoUrl("www.github.com/vercel/next.js")).toEqual({
      platform: "github",
      owner: "vercel",
      repo: "next.js",
    });
    expect(parseRepoUrl("http://github.com/facebook/react")).toEqual({
      platform: "github",
      owner: "facebook",
      repo: "react",
    });
  });

  test("Gitee URL 解析为 owner / repo", () => {
    expect(parseRepoUrl("https://gitee.com/xxx/project")).toEqual({
      platform: "gitee",
      owner: "xxx",
      repo: "project",
    });
  });

  test("GitHub 子页面可规范化为仓库主页地址", () => {
    expect(normalizeGithubRepoUrl("github.com/openai/openai-cookbook/issues/12")).toBe(
      "https://github.com/openai/openai-cookbook",
    );
    expect(normalizeGithubRepoUrl("github.com/vercel/next.js/tree/canary")).toBe(
      "https://github.com/vercel/next.js",
    );
    expect(normalizeGithubRepoUrl("github.com/facebook/react/blob/main/README.md")).toBe(
      "https://github.com/facebook/react",
    );
  });

  test("中文语境下的 GitHub 地址也能提取成功", () => {
    expect(firstGithubRepoUrlFromText("GitHub 地址→github.com/game1024/OpenSpeedy")).toBe(
      "https://github.com/game1024/OpenSpeedy",
    );
    expect(firstGithubRepoUrlFromText("GitHub 地址：github.com/readest/readest")).toBe(
      "https://github.com/readest/readest",
    );
    expect(firstGithubRepoUrlFromText("项目仓库（github.com/lucide-icons/lucide）")).toBe(
      "https://github.com/lucide-icons/lucide",
    );
    expect(firstGithubRepoUrlFromText("仓库地址 https://github.com/openai/openai-cookbook")).toBe(
      "https://github.com/openai/openai-cookbook",
    );
    expect(firstGithubRepoUrlFromText("查看代码：www.github.com/vercel/next.js/tree/canary")).toBe(
      "https://github.com/vercel/next.js",
    );
  });

  test("批量提取与单项目添加共用同一 GitHub 提取 helper", () => {
    expect(extractGithubRepoUrlsFromText("github.com/ourongxing/newsnow").normalizedMatches).toEqual([
      "https://github.com/ourongxing/newsnow",
    ]);
    expect(extractGithubRepoUrlsFromText("github.com/readest/readest").normalizedMatches).toEqual([
      "https://github.com/readest/readest",
    ]);
    expect(
      extractGithubRepoUrlsFromText("GitHub 地址→github.com/game1024/OpenSpeedy").normalizedMatches,
    ).toEqual(["https://github.com/game1024/OpenSpeedy"]);
    expect(
      extractGithubRepoUrlsFromText("GitHub 地址：github.com/readest/readest").normalizedMatches,
    ).toEqual(["https://github.com/readest/readest"]);
  });
  test("project source parser supports github.com and gitcc.com", () => {
    expect(detectProjectSource("https://github.com/vercel/next.js")).toBe("GITHUB");
    expect(parseProjectSourceUrl("https://github.com/vercel/next.js")).toEqual({
      type: "GITHUB",
      url: "https://github.com/vercel/next.js",
      owner: "vercel",
      repo: "next.js",
    });

    expect(detectProjectSource("gitcc.com/acme/demo")).toBe("GITCC");
    expect(parseProjectSourceUrl("https://www.gitcc.com/acme/demo")).toEqual({
      type: "GITCC",
      url: "https://www.gitcc.com/acme/demo",
      owner: null,
      repo: null,
    });
  });

  test("批量项目来源提取支持 GitHub 和 GitCC", () => {
    expect(
      extractProjectSourceUrlsFromText(
        "项目 A https://github.com/lucide-icons/lucide，项目 B https://www.gitcc.com/tokenfree/gvv-ai-erp",
      ).map((item) => ({ type: item.source.type, url: item.source.url })),
    ).toEqual([
      { type: "GITHUB", url: "https://github.com/lucide-icons/lucide" },
      { type: "GITCC", url: "https://www.gitcc.com/tokenfree/gvv-ai-erp" },
    ]);
  });

  test("公众号文章来源可作为项目信息源展示和 AI 输入依据", () => {
    const sources = getProjectSources({
      rows: [
        {
          kind: "WECHAT_ARTICLE",
          url: "https://github.com/lucide-icons/lucide",
          label: "公众号文章",
          title: "Lucide 图标库介绍",
          content: "Lucide 是一个开源图标库，适合开发者在 Web 应用中使用。",
          summary: "公众号文章正文",
          isPrimary: false,
        },
      ],
    });
    expect(sources[0]).toMatchObject({
      kind: "WECHAT_ARTICLE",
      categoryLabel: "公众号文章",
      title: "Lucide 图标库介绍",
      content: "Lucide 是一个开源图标库，适合开发者在 Web 应用中使用。",
    });

    const snapshot = {
      base: {
        projectId: "p1",
        name: "Lucide",
        tagline: null,
        description: null,
        website: null,
        github: null,
        tags: [],
        categories: [],
        recentActivities: [],
      },
      github: { facts: {}, readmeSummary: null },
      website: {
        facts: {},
        hasPricing: false,
        hasDocs: false,
        hasContact: false,
        hasDemo: false,
        hasContent: false,
        hasKeySections: false,
      },
      socials: {
        accounts: {},
        exists: { twitter: false, discord: false, telegram: false, linkedin: false },
      },
      extractedSignals: { mainSources: ["公众号文章"], missingSources: [] },
      sourceContents: [
        {
          kind: "WECHAT_ARTICLE",
          label: "公众号文章",
          title: "Lucide 图标库介绍",
          url: "https://github.com/lucide-icons/lucide",
          summary: "公众号文章正文",
          content: "Lucide 是一个开源图标库，适合开发者在 Web 应用中使用。",
        },
      ],
    } satisfies ProjectInsightSourceSnapshot;
    expect(computeProjectSourceLevel(snapshot)).toBe("B");
  });
});
