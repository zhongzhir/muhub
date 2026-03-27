import { test, expect } from "@playwright/test";
import { loginAsE2EUser } from "./helpers/auth";
import {
  waitForProjectDetailUrl,
  waitForProjectSlugAfterCreate,
} from "./helpers/wait-project-after-create";

test.describe("项目动态", () => {
  test("发布动态后详情页项目动态区显示标题与正文", async ({ page }) => {
    test.skip(
      !process.env.DATABASE_URL?.trim() ||
        !process.env.AUTH_SECRET?.trim() ||
        !process.env.E2E_TEST_SECRET?.trim(),
      "需要 DATABASE_URL（已迁移含 ProjectUpdate）、AUTH_SECRET、E2E_TEST_SECRET；见 .env.example",
    );

    await loginAsE2EUser(page);

    const id = Date.now();
    const projectName = `动态测试项目-${id}`;
    const title = `E2E 动态标题 ${Date.now()}`;
    const body = `E2E 动态正文多行\n第二行内容`;

    await page.goto("/dashboard/projects/new");
    await page.locator("#name").fill(projectName);
    await page.getByRole("button", { name: "创建项目" }).click();
    const slug = await waitForProjectSlugAfterCreate(page);

    // 与产品一致：从详情页「发布动态」进入，避免 goto 手工 encode 与 Next Link 不一致导致查库/权限异常
    const publishLink = page.getByRole("link", { name: "发布动态" }).first();
    await expect(publishLink).toBeVisible();
    await publishLink.click();
    await page.waitForURL(/\/dashboard\/projects\/[^/]+\/updates\/new\/?$/);
    await expect(page.getByRole("heading", { name: "发布项目动态" })).toBeVisible();

    await page.locator("#title").fill(title);
    await page.locator("#content").fill(body);
    await page.getByRole("button", { name: "发布" }).click();
    await waitForProjectDetailUrl(page, slug);

    const heading1 = page.getByRole("heading", { level: 1, name: projectName });
    await expect(heading1).toBeVisible({ timeout: 60_000 });

    const section = page.getByTestId("project-updates-section");
    await expect(section).toBeVisible({ timeout: 60_000 });
    await expect(section.getByRole("heading", { name: "项目动态" })).toBeVisible({ timeout: 60_000 });

    // 等待新动态写入并渲染（软导航 + RSC 可能略慢于 URL 变化）
    await expect(section).toContainText(title, { timeout: 60_000 });
    await expect(section).toContainText("E2E 动态正文", { timeout: 60_000 });
    await expect(section).toContainText("第二行", { timeout: 60_000 });

    const updateItem = section.getByTestId("project-update-item").filter({ hasText: title });
    await expect(updateItem).toBeVisible({ timeout: 60_000 });
    await expect(updateItem.getByTestId("project-update-source-badge")).toHaveText(/手动发布/, {
      timeout: 15_000,
    });
  });
});
