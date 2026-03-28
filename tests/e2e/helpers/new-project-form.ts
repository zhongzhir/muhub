import type { Page } from "@playwright/test";

/**
 * 「手动创建项目」页表单提交按钮。
 * 顶栏另有「创建项目」下拉菜单按钮，若使用页面级 getByRole 会在 Playwright strict mode 下冲突。
 */
export function getCreateProjectSubmitButton(page: Page) {
  return page.locator("form").getByRole("button", { name: "创建项目" });
}
