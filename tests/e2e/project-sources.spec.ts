import { test, expect } from "@playwright/test";

test.describe("项目信息源", () => {
  test("详情 demo：展示项目信息源区块与链接", async ({ page }) => {
    await page.goto("/projects/demo");
    const section = page.getByTestId("project-sources-section");
    await expect(section).toBeVisible();
    await expect(section.getByRole("heading", { name: "项目信息源" })).toBeVisible();
    await expect(section.getByTestId("project-source-link").first()).toBeVisible();
  });
});
