import { test, expect } from "@playwright/test";

test.describe("项目广场 /projects", () => {
  test("页面标题与搜索区", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByRole("heading", { level: 1, name: "项目广场" })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "搜索项目" })).toBeVisible();
    await expect(page.getByRole("button", { name: "搜索" })).toBeVisible();
  });

  test("有数据时展示卡片，无数据时展示空状态", async ({ page }) => {
    await page.goto("/projects");
    const emptyAll = page.getByTestId("projects-empty-all");
    const card = page.getByTestId("project-card").first();
    await expect(emptyAll.or(card)).toBeVisible();
    if (await card.isVisible()) {
      await expect(card.getByTestId("project-badges")).toBeVisible();
    }
  });

  test("带搜索参数可打开并显示当前搜索词", async ({ page }) => {
    await page.goto("/projects?q=demo");
    await expect(page.getByRole("heading", { level: 1, name: "项目广场" })).toBeVisible();
    await expect(page.getByText("当前搜索：", { exact: false })).toBeVisible();
    await expect(page.getByText("demo", { exact: true }).first()).toBeVisible();
  });

  test("搜索无结果时出现提示", async ({ page }) => {
    await page.goto("/projects?q=__no_such_project_xyz_123__");
    await expect(page.getByTestId("projects-empty-search")).toBeVisible();
  });
});
