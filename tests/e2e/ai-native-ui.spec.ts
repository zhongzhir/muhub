import { test, expect } from "@playwright/test";
import { loginAsE2EUser } from "./helpers/auth";
import { getCreateProjectSubmitButton } from "./helpers/new-project-form";
import { waitForProjectSlugAfterCreate } from "./helpers/wait-project-after-create";

test.describe("AI Native 第一阶段（UI 与降级）", () => {
  test("演示项目：动态含来源与 AI 摘要徽章，标签区可见", async ({ page }) => {
    await page.goto("/projects/demo");
    const section = page.getByTestId("project-updates-section");
    await expect(section.getByTestId("project-update-source-badge").first()).toBeVisible();
    await expect(section.getByTestId("project-update-ai-badge").first()).toBeVisible();
    await expect(section.getByTestId("project-update-ai-summary").first()).toBeVisible();
    await expect(page.getByTestId("project-tags")).toBeVisible();
  });

  test("分享页：演示数据可含标签区", async ({ page }) => {
    await page.goto("/projects/demo/share");
    const tags = page.getByTestId("share-project-tags");
    if ((await tags.count()) > 0) {
      await expect(tags).toBeVisible();
    }
  });

  test("无 OPENAI_API_KEY 时创建项目仍可完成跳转（静默跳过补全）", async ({ page }) => {
    test.skip(!!process.env.OPENAI_API_KEY?.trim(), "本地若设了 OPENAI_API_KEY 则跳过本降级用例");
    test.skip(!process.env.DATABASE_URL?.trim(), "需要 DATABASE_URL");

    await loginAsE2EUser(page);

    const id = Date.now();
    const projectName = `AI 降级测-${id}`;
    await page.goto("/dashboard/projects/new");
    await page.locator("#name").fill(projectName);
    await getCreateProjectSubmitButton(page).click();
    await waitForProjectSlugAfterCreate(page);
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  });
});
