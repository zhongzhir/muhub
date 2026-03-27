import { test, expect } from "@playwright/test";

test.describe("推荐项目认领", () => {
  test("详情页认领入口或直链：创建页含 from=recommended 且表单预填", async ({ page }) => {
    await page.goto("/projects/langchain");
    await expect(page.getByRole("heading", { level: 1, name: "LangChain" })).toBeVisible({
      timeout: 15_000,
    });

    const hint = page.getByTestId("recommended-project-hint");
    if (await hint.isVisible()) {
      await expect(page.getByText("这是推荐项目")).toBeVisible();
      await expect(page.getByText("认领后可编辑管理")).toBeVisible();
      await page.getByTestId("claim-recommended-button").click();
      await page.waitForURL(/\/dashboard\/projects\/new\?/);
    } else {
      // 库中已存在同 slug 的正式项目时，推荐提示不会出现；改测认领链接对应的预填逻辑
      await page.goto("/dashboard/projects/new?from=recommended&slug=langchain");
    }

    await expect(page).toHaveURL(/from=recommended/);
    await expect(page).toHaveURL(/slug=langchain/);

    await expect(page.locator("#name")).toHaveValue("LangChain");
    await expect(page.locator("#project-slug-input")).toHaveValue("langchain");
    await expect(page.locator("#tagline")).toHaveValue("Build LLM applications");
    await expect(page.locator("#githubUrl")).toHaveValue("https://github.com/langchain-ai/langchain");
  });
});
