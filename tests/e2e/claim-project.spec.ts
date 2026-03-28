import { test, expect } from "@playwright/test";
import { loginAsE2EUser } from "./helpers/auth";
import {
  waitForProjectDetailUrl,
  waitForProjectSlugAfterCreate,
} from "./helpers/wait-project-after-create";

test.describe("项目认领", () => {
  test("未认领项目可填写 GitHub 地址完成认领", async ({ page }) => {
    test.skip(
      !process.env.DATABASE_URL?.trim() ||
        !process.env.AUTH_SECRET?.trim() ||
        !process.env.E2E_TEST_SECRET?.trim(),
      "需要 DATABASE_URL（已迁移）、AUTH_SECRET、E2E_TEST_SECRET；见 .env.example",
    );

    await loginAsE2EUser(page);

    const projectName = `认领测试项目-${Date.now()}`;
    const github = "https://github.com/octocat/Hello-World";

    await page.goto("/dashboard/projects/new");
    await page.locator("#name").fill(projectName);
    await page.locator("#githubUrl").fill(github);
    await page.getByRole("button", { name: "创建项目" }).click();
    const slug = await waitForProjectSlugAfterCreate(page);

    await page.goto(`/projects/${slug}/claim`);
    await expect(page.getByRole("heading", { name: "认领项目" })).toBeVisible();

    await page.getByTestId("repo-url-input").fill(github);
    await page.getByRole("button", { name: "认领项目" }).click();

    await waitForProjectDetailUrl(page, slug);

    await expect(page.getByRole("heading", { level: 1, name: projectName })).toBeVisible({
      timeout: 60_000,
    });

    const claimed = page.getByTestId("project-claimed-label");
    await expect(claimed).toHaveText("已认领", { timeout: 60_000 });
    await expect(page.getByTestId("claim-project-button")).toHaveCount(0);
  });
});
