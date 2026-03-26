import { test, expect } from "@playwright/test";

test("冒烟：首页可访问", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "木哈布", exact: true })).toBeVisible();
  await expect(page.getByTestId("home-beta-notice")).toBeVisible();
});
