import { test, expect } from "@playwright/test";

test("分享名片页：核心信息、动态区与复制链接反馈", async ({ page }) => {
  await page.goto("/projects/demo/share");
  await expect(page.getByTestId("share-project-name")).toHaveText("示例开源项目");
  await expect(page.getByTestId("share-project-tagline")).toHaveText("MUHUB 演示项目的标语示例");
  await expect(page.getByTestId("project-badges")).toBeVisible();

  const recent = page.getByTestId("share-recent-updates");
  await expect(recent).toBeVisible();
  await expect(
    recent.getByTestId("share-recent-update-item").first().or(recent.getByText("暂无动态")),
  ).toBeVisible();

  const copyBtn = page.getByTestId("copy-share-link");
  await expect(copyBtn).toBeVisible();
  await expect(copyBtn).toHaveText("复制分享链接");

  await copyBtn.click();
  // 无头环境可能无剪贴板权限：成功为「已复制链接」+ role=status；失败时按钮为「复制失败，请重试」
  await expect(copyBtn).toHaveText(/已复制链接|复制失败/);
  if ((await page.getByRole("status").count()) > 0) {
    await expect(page.getByRole("status")).toHaveText("已复制链接");
  }

  // 内置 demo 有快照时会展示；若数据库已占用了 slug demo 且无快照，区块可不存在
  const stats = page.getByTestId("share-github-stats");
  if ((await stats.count()) > 0) {
    await expect(stats).toBeVisible();
  }
});
