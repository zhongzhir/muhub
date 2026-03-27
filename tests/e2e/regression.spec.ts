import { test, expect } from "@playwright/test";

test.describe("木哈布 回归", () => {
  test("首页包含木哈布", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "木哈布 MUHUB", exact: true })).toBeVisible();
  });

  test("创建项目页", async ({ page }) => {
    await page.goto("/dashboard/projects/new");
    await expect(page.getByRole("heading", { name: "创建项目" })).toBeVisible();
  });

  test("项目详情 demo", async ({ page }) => {
    await page.goto("/projects/demo");
    await expect(page.getByText("项目主页", { exact: true })).toBeVisible();
    await expect(page.getByTestId("project-sources-section")).toBeVisible();
    const section = page.getByTestId("project-updates-section");
    await expect(section).toBeVisible();
    await expect(section.getByRole("heading", { name: "项目动态" })).toBeVisible();
    const itemCount = await section.getByTestId("project-update-item").count();
    if (itemCount > 0) {
      await expect(section.getByTestId("project-update-source-badge").first()).toBeVisible();
    }
  });
});
