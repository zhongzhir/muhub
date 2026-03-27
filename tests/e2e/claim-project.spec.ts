import { test, expect } from "@playwright/test";

test.describe("项目认领", () => {
  test("未认领项目可填写 GitHub 地址完成认领", async ({ page }) => {
    test.skip(!process.env.DATABASE_URL?.trim(), "需要 DATABASE_URL 且已迁移");

    const projectName = `认领测试项目-${Date.now()}`;
    const github = "https://github.com/octocat/Hello-World";

    await page.goto("/dashboard/projects/new");
    await page.locator("#name").fill(projectName);
    await page.locator("#githubUrl").fill(github);
    await page.getByRole("button", { name: "创建项目" }).click();
    await page.waitForURL(`**/projects/${projectName}`);

    await expect(page.getByTestId("claim-project-button")).toBeVisible();

    await page.getByTestId("claim-project-button").click();
    await expect(page.getByRole("heading", { name: "认领项目" })).toBeVisible();

    await page.getByTestId("repo-url-input").fill(github);
    await page.getByRole("button", { name: "认领项目" }).click();

    await page.waitForURL(`**/projects/${projectName}`);
    await expect(page.getByTestId("project-claimed-label")).toHaveText("已认领");
    await expect(page.getByTestId("claim-project-button")).toHaveCount(0);
  });
});
