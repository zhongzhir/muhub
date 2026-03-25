import { test, expect } from "@playwright/test";

test("分享页：打开 share 路由并显示项目名称与 tagline", async ({ page }) => {
  await page.goto("/projects/demo/share");
  await expect(page.getByTestId("share-project-name")).toHaveText("示例开源项目");
  await expect(page.getByTestId("share-project-tagline")).toHaveText("MUHUB 演示项目的标语示例");
});
