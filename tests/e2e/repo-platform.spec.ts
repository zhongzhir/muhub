import { test, expect } from "@playwright/test";
import {
  extractGithubRepoUrlsFromText,
  firstGithubRepoUrlFromText,
  normalizeGithubRepoUrl,
} from "@/lib/discovery/normalize-url";
import { parseRepoUrl } from "@/lib/repo-platform";
import { detectProjectSource, parseProjectSourceUrl } from "@/lib/project-source-url";

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
});
