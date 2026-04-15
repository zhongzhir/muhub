import { test, expect } from "@playwright/test";

/**
 * 上线前验收：公开页面基础冒烟
 *
 * 目标：证明主要公开路由可打开、页面不崩溃，并包含少量“稳定锚点”文本/结构。
 */
test.describe("公开页：基础冒烟", () => {
  test("首页可打开并包含核心信息", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.ok(), `首页 HTTP 状态异常: ${res?.status()}`).toBeTruthy();

    // 与现有 smoke.spec.ts 对齐：使用稳定标题 + Hero CTA 锚点
    await expect(page.getByRole("heading", { name: "木哈布 MUHUB", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "浏览项目" })).toBeVisible();
    await expect(page.getByRole("link", { name: "查看最新动态" })).toBeVisible();
  });

  test("项目广场可打开（有卡片或空状态）", async ({ page }) => {
    const res = await page.goto("/projects");
    expect(res?.ok(), `项目广场 HTTP 状态异常: ${res?.status()}`).toBeTruthy();

    await expect(page.getByRole("heading", { level: 1, name: "项目广场" })).toBeVisible();

    const emptyAll = page.getByTestId("projects-empty-all");
    const card = page.getByTestId("project-card").first();
    await expect(emptyAll.or(card)).toBeVisible();
  });

  test("法务页面可打开", async ({ page }) => {
    for (const path of ["/terms", "/privacy", "/legal"] as const) {
      const res = await page.goto(path);
      expect(res?.ok(), `${path} HTTP 状态异常: ${res?.status()}`).toBeTruthy();
      // 不强依赖具体标题文案：至少页面应渲染出 body 文本（避免空白/500 页）
      await expect(page.locator("body")).not.toHaveText("");
    }
  });
});
