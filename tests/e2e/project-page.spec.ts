import { test, expect } from "@playwright/test";

/**
 * 上线前验收：项目详情页主入口（展示/分享/活动）
 *
 * 说明：
 * - 不强依赖固定 slug；优先从项目广场第一个卡片进入详情页。
 * - 若环境无项目数据，则跳过（避免脆弱失败）。
 */
test.describe("项目详情页：关键入口存在", () => {
  test("从项目广场进入第一个项目详情页并检查关键模块", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByRole("heading", { level: 1, name: "项目广场" })).toBeVisible();

    const card = page.getByTestId("project-card").first();
    test.skip(!(await card.isVisible()), "当前环境无项目数据：跳过项目详情页用例");

    // plaza 卡片：覆盖层点击在部分环境下可能被其它层拦截；这里用卡片内展示的 slug 直接导航，更稳定
    const slugText = await card.locator("span.font-mono").first().innerText();
    const slug = slugText.trim();
    test.skip(!slug, "无法从项目卡片读取 slug：跳过项目详情页用例");

    await page.goto(`/projects/${encodeURIComponent(slug)}`);
    await page.waitForURL(/\/projects\/[^/?#]+\/?$/);

    // 关键模块：详情头部 + 信息源 + 动态区（使用稳定 testid，避免文案调整导致脆弱失败）
    await expect(page.getByText("项目主页", { exact: true })).toBeVisible();
    await expect(page.getByTestId("project-sources-section")).toBeVisible();
    await expect(page.getByTestId("project-updates-section")).toBeVisible();
  });
});
