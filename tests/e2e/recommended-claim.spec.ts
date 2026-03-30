import { test, expect } from "@playwright/test";
import { loginAsE2EUser } from "./helpers/auth";

test.describe("推荐项目认领", () => {
  test("推荐直链：创建页含 from=recommended 且表单预填", async ({ page }) => {
    test.skip(!process.env.DATABASE_URL?.trim(), "需要 DATABASE_URL（登录注入与会话依赖数据库）");

    await loginAsE2EUser(page);

    await page.goto("/projects/langchain");
    await expect(page.getByRole("heading", { level: 1, name: "LangChain" })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/dashboard/projects/new?from=recommended&slug=langchain");

    await expect(page).toHaveURL(/from=recommended/);
    await expect(page).toHaveURL(/slug=langchain/);

    await expect(page.locator("#name")).toHaveValue("LangChain");
    await expect(page.locator("#tagline")).toHaveValue("Build LLM applications");
    await expect(page.locator("#githubUrl")).toHaveValue("https://github.com/langchain-ai/langchain");
  });
});
