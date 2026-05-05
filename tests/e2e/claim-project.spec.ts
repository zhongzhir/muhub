import { test, expect } from "@playwright/test";
import { loginAsE2EUser } from "./helpers/auth";
import { getCreateProjectSubmitButton } from "./helpers/new-project-form";
import { waitForProjectSlugAfterCreate } from "./helpers/wait-project-after-create";

test.describe("项目认领", () => {
  test("未认领项目可提交人工认领申请", async ({ page }) => {
    test.setTimeout(120_000);
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
    await getCreateProjectSubmitButton(page).click();
    const slug = await waitForProjectSlugAfterCreate(page);

    await page.goto(`/projects/${encodeURIComponent(slug)}/claim`);
    await expect(page.getByRole("heading", { name: "认领项目" })).toBeVisible();
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

    await page.locator("#claimantName").fill("E2E 认领联系人");
    await page.locator("#claimantRole").selectOption("项目创始人");
    await page.locator("#contactEmail").fill(`claim-${Date.now()}@example.com`);
    await page.locator("#proofUrl").fill("https://github.com/octocat");
    await page.locator("#message").fill("E2E 人工认领申请");
    await page.getByRole("button", { name: "提交认领申请" }).click();

    const success = page.getByTestId("claim-success");
    const formErrorAlert = page.locator('[data-testid="project-claim-form"] [role="alert"]').first();
    await expect(success.or(formErrorAlert)).toBeVisible({ timeout: 60_000 });
    if (await formErrorAlert.isVisible()) {
      const message = (await formErrorAlert.textContent())?.trim() ?? "unknown error";
      throw new Error(`认领提交未成功，页面返回错误：${message}`);
    }
    await expect(success).toContainText(/认领申请已提交|认领申请已存在/);
    await expect(page.getByRole("link", { name: "返回项目页" })).toHaveAttribute(
      "href",
      `/projects/${encodeURIComponent(slug)}`,
    );
  });
});
