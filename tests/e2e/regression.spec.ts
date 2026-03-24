import { test, expect } from "@playwright/test";

test.describe("MUHUB 回归", () => {
  test("首页包含 MUHUB", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "MUHUB" })).toBeVisible();
  });

  test("创建项目页", async ({ page }) => {
    await page.goto("/dashboard/projects/new");
    await expect(page.getByRole("heading", { name: "创建项目" })).toBeVisible();
  });

  test("项目详情 demo", async ({ page }) => {
    await page.goto("/projects/demo");
    await expect(page.getByText("项目主页", { exact: true })).toBeVisible();
  });
});
