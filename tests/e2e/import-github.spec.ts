import { test, expect } from "@playwright/test";

test.describe("从 GitHub 导入", () => {
  test("错误地址提示 GitHub 地址格式错误", async ({ page }) => {
    await page.goto("/dashboard/projects/import");
    await expect(page.getByRole("heading", { name: "从 GitHub 导入项目" })).toBeVisible();
    await page.getByLabel("GitHub 仓库地址").fill("https://example.com/not-github");
    await page.getByRole("button", { name: "导入项目" }).click();
    await expect(page.getByText("GitHub 地址格式错误")).toBeVisible();
  });

  test("Fixture 仓库导入后跳转创建页并预填", async ({ page }) => {
    test.skip(
      process.env.GITHUB_IMPORT_E2E_FIXTURE !== "1",
      "设置 GITHUB_IMPORT_E2E_FIXTURE=1 时使用内置 fixture（CI 默认开启）",
    );

    await page.goto("/dashboard/projects/import");
    await page.getByLabel("GitHub 仓库地址").fill("https://github.com/muhub/e2e-fixture");
    await page.getByRole("button", { name: "导入项目" }).click();

    await page.waitForURL(/\/dashboard\/projects\/new\?/);
    await expect(page).toHaveURL(/name=/);
    await expect(page.locator("#name")).toHaveValue("E2E Fixture Repo");
    await expect(page.locator("#tagline")).toHaveValue("Fixture description for Playwright");
    await expect(page.locator("#githubUrl")).toHaveValue("https://github.com/muhub/e2e-fixture");
    await expect(page.locator("#websiteUrl")).toHaveValue("https://example.com");
  });
});
