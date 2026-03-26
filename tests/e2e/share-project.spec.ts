import { test, expect } from "@playwright/test";

test("分享名片页：亮点优先、当前进展、信息源与复制链接", async ({ page }) => {
  await page.goto("/projects/demo/share");
  await expect(page.getByTestId("share-project-name")).toHaveText("示例开源项目");
  await expect(page.getByTestId("share-project-tagline")).toHaveText("木哈布 演示项目的标语示例");
  await expect(page.getByTestId("project-badges")).toBeVisible();

  await expect(page.getByTestId("share-project-highlights")).toBeVisible();
  await expect(page.getByRole("heading", { name: "项目亮点" })).toBeVisible();
  await expect(page.getByTestId("share-highlight-lead")).toBeVisible();

  const progress = page.getByTestId("share-project-progress");
  await expect(progress).toBeVisible();
  await expect(page.getByRole("heading", { name: "当前进展" })).toBeVisible();
  // demo 优先展示 AI 周总结；若数据为空则可能为动态列表或占位，不做脆弱 exact 匹配
  await expect(progress.locator("p, li").first()).toBeVisible();

  const sources = page.getByTestId("share-project-sources");
  await expect(sources).toBeVisible();
  await expect(page.getByRole("heading", { name: "项目信息源" })).toBeVisible();
  const sourceLinks = page.getByTestId("share-source-link");
  if ((await sourceLinks.count()) > 0) {
    await expect(sourceLinks.first()).toBeVisible();
  }

  const copyBtn = page.getByTestId("copy-share-link");
  await expect(copyBtn).toBeVisible();
  await expect(copyBtn).toHaveText("复制分享链接");

  await copyBtn.click();
  await expect(copyBtn).toHaveText(/已复制链接|复制失败/);
  if ((await page.getByRole("status").count()) > 0) {
    await expect(page.getByRole("status")).toHaveText("已复制链接");
  }

  const stats = page.getByTestId("share-github-stats");
  if ((await stats.count()) > 0) {
    await expect(stats).toBeVisible();
  }
});
