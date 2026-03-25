import { test, expect } from "@playwright/test";

test.describe("项目动态", () => {
  test("发布动态后详情页项目动态区显示标题与正文", async ({ page }) => {
    test.skip(
      !process.env.DATABASE_URL?.trim(),
      "需要 DATABASE_URL 且已迁移（含 ProjectUpdate 多源字段）",
    );

    const slug = `e2e-upd-${Date.now()}`;
    const title = `E2E 动态标题 ${Date.now()}`;
    const body = `E2E 动态正文多行\n第二行内容`;

    await page.goto("/dashboard/projects/new");
    await page.locator("#name").fill("动态测试项目");
    await page.locator("#slug").fill(slug);
    await page.getByRole("button", { name: "创建项目" }).click();
    await page.waitForURL(`**/projects/${slug}`);

    await page.goto(`/dashboard/projects/${slug}/updates/new`);
    await expect(page.getByRole("heading", { name: "发布项目动态" })).toBeVisible();

    await page.locator("#title").fill(title);
    await page.locator("#content").fill(body);
    await page.getByRole("button", { name: "发布" }).click();
    await page.waitForURL(`**/projects/${slug}`);

    const section = page.getByTestId("project-updates-section");
    await expect(section).toBeVisible();
    await expect(section.getByRole("heading", { name: "项目动态" })).toBeVisible();
    await expect(section.getByText(title).first()).toBeVisible();

    const updateItem = section.getByTestId("project-update-item").filter({ hasText: title });
    await expect(updateItem).toBeVisible();
    await expect(updateItem.getByTestId("project-update-source-badge")).toHaveText(/手动发布/);
    await expect(updateItem).toContainText("E2E 动态正文");
    await expect(updateItem).toContainText("第二行");
  });
});
