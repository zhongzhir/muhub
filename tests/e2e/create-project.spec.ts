import { test, expect } from "@playwright/test";

test.describe("创建项目链路", () => {
  test("提交表单后跳转详情并展示数据", async ({ page }) => {
    test.skip(!process.env.DATABASE_URL?.trim(), "需要配置 DATABASE_URL 且已执行 prisma migrate deploy");

    const suffix = `e2e-${Date.now()}`;
    const projectName = `E2E 项目 ${suffix}`;
    const expectedSlug = `e2e-项目-${suffix}`;
    await page.goto("/dashboard/projects/new");

    await page.locator("#name").fill(projectName);
    await page.locator("#tagline").fill("链路测试标语");
    await page.locator("#description").fill("这是 Playwright 创建链路的项目介绍正文。");
    await page.locator("#githubUrl").fill("https://github.com/octocat/hello-world");
    await page.locator("#websiteUrl").fill("https://example.com");
    await page.locator("#docsUrl").fill("https://docs.example.com");
    await page.locator("#weibo").fill("@e2e-weibo");
    await page.locator("#wechat_official").fill("E2E 公众号");

    await page.getByRole("button", { name: "创建项目" }).click();

    await page.waitForURL(`**/projects/${expectedSlug}`);
    await expect(page.getByRole("heading", { level: 1, name: projectName })).toBeVisible();
    await expect(page.getByText("项目主页", { exact: true })).toBeVisible();
    await expect(page.getByText("这是 Playwright 创建链路的项目介绍正文。")).toBeVisible();

    const sources = page.getByTestId("project-sources-section");
    await expect(sources).toBeVisible();
    await expect(sources).toContainText("文档");
  });
});
