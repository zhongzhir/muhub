import { test, expect } from "@playwright/test";
import {
  waitForProjectDetailUrl,
  waitForProjectSlugAfterCreate,
} from "./helpers/wait-project-after-create";

test.describe("GitHub 手动刷新快照", () => {
  test("带 githubUrl 的项目可刷新并在详情展示 Stars / Forks 等", async ({ page }) => {
    test.skip(!process.env.DATABASE_URL?.trim(), "需要 DATABASE_URL 且已迁移");

    test.skip(
      process.env.GITHUB_IMPORT_E2E_FIXTURE !== "1" &&
        process.env.GITHUB_REFRESH_E2E_FIXTURE !== "1",
      "设置 GITHUB_IMPORT_E2E_FIXTURE=1 或 GITHUB_REFRESH_E2E_FIXTURE=1 时使用内置 fixture（CI 默认开启前者）",
    );

    const projectName = `GitHub 刷新测试-${Date.now()}`;

    await page.goto("/dashboard/projects/new");
    await page.locator("#name").fill(projectName);
    await page.locator("#githubUrl").fill("https://github.com/muhub/e2e-fixture");
    await page.getByRole("button", { name: "创建项目" }).click();
    const slug = await waitForProjectSlugAfterCreate(page);

    const section = page.getByTestId("github-snapshot-section");
    await expect(section.getByRole("heading", { name: "仓库数据" })).toBeVisible();
    await expect(section.getByText("暂无仓库快照数据")).toBeVisible();

    await page.getByTestId("refresh-github-snapshot").click();
    await waitForProjectDetailUrl(page, slug);

    await expect(section.getByTestId("github-snapshot-repo")).toHaveText("muhub/e2e-fixture");
    await expect(section.getByTestId("github-snapshot-stars")).toContainText("42");
    await expect(section.getByTestId("github-snapshot-forks")).toContainText("7");
    await expect(section.getByTestId("github-snapshot-issues")).toBeVisible();
    await expect(section.getByTestId("github-snapshot-watchers")).toBeVisible();

    await expect(section.getByTestId("github-snapshot-platform")).toHaveText("GitHub");
    await expect(section.getByTestId("github-snapshot-activity")).toContainText("活跃项目");
    await expect(section.getByTestId("github-snapshot-last-commit")).toBeVisible();
    await expect(section.getByTestId("github-snapshot-release")).toContainText("v0.9.9-fixture");
  });
});
