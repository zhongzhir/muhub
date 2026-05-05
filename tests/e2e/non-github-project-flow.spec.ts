import { expect, test } from "@playwright/test";
import { loginAsE2EUser } from "./helpers/auth";
import { getCreateProjectSubmitButton } from "./helpers/new-project-form";
import { waitForProjectSlugAfterCreate } from "./helpers/wait-project-after-create";

test.describe("无 GitHub 项目流转", () => {
  test("无 GitHub 项目可创建、编辑、发布并在前台展示空态仓库模块", async ({ page }) => {
    test.skip(!process.env.DATABASE_URL?.trim(), "需要配置 DATABASE_URL 且已执行 prisma migrate deploy");

    await loginAsE2EUser(page);

    const projectName = `E2E Non GitHub Project ${Date.now()}`;
    await page.goto("/dashboard/projects/new");

    await page.locator("#name").fill(projectName);
    await page.locator("#tagline").fill("测试无 GitHub 项目");
    await page.locator("#description").fill("测试无 GitHub 项目");
    await page.locator("#websiteUrl").fill("https://example.com/non-github-project");
    await page.locator("#githubUrl").fill("");

    await getCreateProjectSubmitButton(page).click();
    const slug = await waitForProjectSlugAfterCreate(page);

    await expect(page.getByRole("heading", { level: 1, name: projectName })).toBeVisible();

    await page.goto(`/dashboard/projects/${encodeURIComponent(slug)}/edit`);
    await expect(page.getByRole("heading", { level: 1, name: "编辑项目" })).toBeVisible();
    await expect(page.locator("#githubUrl")).toHaveValue("");
    await expect(page.locator('label[for="githubUrl"]')).not.toContainText("必填");

    await page.getByRole("button", { name: "公开项目" }).click();
    const statusText = page.getByText("当前状态：", { exact: false }).first();
    const publishError = page.getByRole("alert");
    await expect(statusText.or(publishError)).toBeVisible({ timeout: 60_000 });
    if (await publishError.isVisible()) {
      const message = (await publishError.textContent())?.trim() ?? "unknown publish error";
      throw new Error(`无 GitHub 项目发布失败：${message}`);
    }
    await expect
      .poll(
        async () => {
          await page.reload();
          return ((await statusText.textContent()) ?? "").trim();
        },
        { timeout: 60_000, message: "公开项目后状态应更新为已公开" },
      )
      .toContain("已公开");

    const res = await page.goto(`/projects/${encodeURIComponent(slug)}`);
    expect(res?.ok(), `项目详情页 HTTP 状态异常: ${res?.status()}`).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1, name: projectName })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "代码仓库数据" })).toBeVisible();
    await expect(page.getByText("暂无代码仓库数据")).toBeVisible();
  });
});
