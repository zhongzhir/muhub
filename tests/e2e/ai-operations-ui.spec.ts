import { test, expect } from "@playwright/test";

test.describe("AI 运营（第一阶段 UI）", () => {
  test("详情 demo：公开页不展示 AI 摘要卡", async ({ page }) => {
    await page.goto("/projects/demo");
    await expect(page.getByTestId("project-ai-summary")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
