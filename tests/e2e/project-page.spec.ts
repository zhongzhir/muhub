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
    await expect(page).toHaveURL(new RegExp(`/projects/${slug}/?$`));

    // 展示/分享/活动：用“任一存在即可”的软断言组合，避免不同项目模板差异导致脆弱失败
    const sharePoster = page.getByRole("button", { name: /Share Poster|分享海报/i });
    const copyPromo = page.getByRole("button", { name: /Copy Promo|复制推广/i });
    const projectActivity = page.getByText(/Project Activity|项目动态/i);
    const highlights = page.getByText(/Highlights|亮点/i);
    const summary = page.getByText(/Summary|摘要/i);
    const latestActivity = page.getByText(/Latest Activity|最新动态/i);

    const anyKeyEntry = sharePoster
      .or(copyPromo)
      .or(projectActivity)
      .or(highlights)
      .or(summary)
      .or(latestActivity)
      .first();

    await expect(anyKeyEntry).toBeVisible();
  });
});
