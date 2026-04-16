import { test, expect } from "@playwright/test";
import { normalizeGithubRepoUrl } from "@/lib/discovery/normalize-url";
import { parseRepoUrl } from "@/lib/repo-platform";

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
});
