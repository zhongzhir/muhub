import { test, expect } from "@playwright/test";

test("冒烟：首页可访问", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "木哈布 MUHUB", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "浏览项目" })).toBeVisible();
  await expect(page.getByRole("link", { name: "查看最新动态" })).toBeVisible();
});
