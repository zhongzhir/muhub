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

    const projectName = `claim-e2e-project-${Date.now()}`;
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
    const contactEmail = `claim-${Date.now()}@example.com`;
    await page.locator("#contactEmail").fill(contactEmail);
    await page.locator("#proofUrl").fill("https://github.com/octocat");
    await page.locator("#message").fill("E2E 人工认领申请");
    const claimResp = await page.request.post(`/api/projects/${encodeURIComponent(slug)}/claim`, {
      data: {
        claimantName: "E2E 认领联系人",
        claimantRole: "项目创始人",
        contactEmail,
        proofUrl: "https://github.com/octocat",
        message: "E2E 人工认领申请",
      },
    });
    expect(claimResp.ok(), `认领 API 请求失败: HTTP ${claimResp.status()} ${await claimResp.text()}`).toBeTruthy();
    const claimJson = (await claimResp.json()) as {
      ok?: boolean;
      message?: string;
      duplicate?: boolean;
    };
    expect(claimJson.ok).toBeTruthy();
    expect(claimJson.message ?? "").toMatch(/认领申请已提交|你已经提交过认领申请/);
  });
});
