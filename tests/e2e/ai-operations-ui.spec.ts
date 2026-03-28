import { test, expect } from "@playwright/test";

test.describe("AI 运营（第一阶段 UI）", () => {
  test("详情 demo：AI 摘要卡", async ({ page }) => {
    await page.goto("/projects/demo");
    await expect(page.getByTestId("project-ai-summary")).toBeVisible();
    await expect(page.getByTestId("project-ai-summary")).toContainText("AI 项目摘要");
  });
});
