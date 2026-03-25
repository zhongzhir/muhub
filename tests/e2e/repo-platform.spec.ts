import { test, expect } from "@playwright/test";
import { parseRepoUrl } from "@/lib/repo-platform";

test.describe("多平台仓库 URL 解析", () => {
  test("GitHub URL 解析为 owner / repo", () => {
    expect(parseRepoUrl("https://github.com/vercel/next.js")).toEqual({
      platform: "github",
      owner: "vercel",
      repo: "next.js",
    });
  });

  test("Gitee URL 解析为 owner / repo", () => {
    expect(parseRepoUrl("https://gitee.com/xxx/project")).toEqual({
      platform: "gitee",
      owner: "xxx",
      repo: "project",
    });
  });
});
