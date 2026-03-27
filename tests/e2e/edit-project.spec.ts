import { test, expect } from "@playwright/test";

test.describe("编辑项目链路", () => {
  test("创建后进入编辑页、修改名称并保存回详情", async ({ page }) => {
    test.skip(!process.env.DATABASE_URL?.trim(), "需要 DATABASE_URL 且已迁移");

    const slug = `e2e-edit-${Date.now()}`;

    await page.goto("/dashboard/projects/new");
    await page.locator("#name").fill("编辑前名称");
    await page.locator("#project-slug-input").fill(slug);
    await page.locator("#tagline").fill("原始标语");
    await page.getByRole("button", { name: "创建项目" }).click();
    await page.waitForURL(`**/projects/${slug}`);

    await page.goto(`/dashboard/projects/${slug}/edit`);
    await expect(page.getByRole("heading", { name: "编辑项目" })).toBeVisible();
    await expect(page.getByText(slug)).toBeVisible();

    await page.locator("#name").fill("编辑后名称");
    await page.locator("#tagline").fill("修改后的标语");
    await page.getByRole("button", { name: "保存修改" }).click();

    await page.waitForURL(`**/projects/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: "编辑后名称" })).toBeVisible();
    await expect(page.getByText("修改后的标语")).toBeVisible();
  });
});
