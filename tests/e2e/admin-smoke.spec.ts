import { test, expect } from "@playwright/test";

import { loginAsE2EUser, skipWithoutE2EAuthGate } from "./helpers/auth";

function isTruthyEnv(value: string | undefined) {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function shouldSkipAdminLoggedInTests() {
  // 1) 开发环境放行任意登录用户访问 /admin
  if (process.env.NODE_ENV === "development" && isTruthyEnv(process.env.MUHUB_ADMIN_DEV_ALLOW_ALL)) {
    return { skip: false as const, reason: "" };
  }

  // 2) 显式配置管理员白名单（推荐：把 E2E 用户 id 配进去）
  const raw = process.env.MUHUB_ADMIN_USER_IDS?.trim() ?? "";
  if (!raw) {
    return {
      skip: true as const,
      reason:
        "未配置 MUHUB_ADMIN_USER_IDS（或未开启 MUHUB_ADMIN_DEV_ALLOW_ALL=true）。请按 tests/README.md 配置后再跑 admin 用例。",
    };
  }

  return { skip: false as const, reason: "" };
}

test.describe("后台：/admin/discovery/items", () => {
  test("未登录访问应被拦截（不应停留在 admin 页面）", async ({ page }) => {
    await page.goto("/admin/discovery/items");

    await expect(page).not.toHaveURL(/\/admin\/discovery\/items$/);

    // middleware 会先要求登录；AdminLayout 也可能进一步 redirect
    await expect(
      page.getByRole("heading", { name: "登录", exact: true }).or(page.getByText("登录", { exact: true })),
    ).toBeVisible();
  });

  test("已登录（E2E Cookie）时可访问并包含关键运营按钮/面板", async ({ page }) => {
    skipWithoutE2EAuthGate();

    const gate = shouldSkipAdminLoggedInTests();
    test.skip(gate.skip, gate.reason);

    const { userId } = await loginAsE2EUser(page);

    // 若使用白名单模式：需要把 E2E 用户 id 配进 MUHUB_ADMIN_USER_IDS
    if (!isTruthyEnv(process.env.MUHUB_ADMIN_DEV_ALLOW_ALL)) {
      const allowList = new Set(
        (process.env.MUHUB_ADMIN_USER_IDS ?? "")
          .split(/[,，\s]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
      test.skip(
        !allowList.has(userId),
        `当前 E2E 用户不在 MUHUB_ADMIN_USER_IDS 白名单内。请将 ${userId} 加入 MUHUB_ADMIN_USER_IDS，或设置 MUHUB_ADMIN_DEV_ALLOW_ALL=true（仅本地）。`,
      );
    }

    const res = await page.goto("/admin/discovery/items");
    expect(res?.ok(), `admin 页 HTTP 状态异常: ${res?.status()}`).toBeTruthy();

    await expect(page.getByRole("heading", { name: "Discovery 队列（JSON · 基础版）" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Run GitHub V3" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run RSS Discovery" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run Project Activity" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run Content Pipeline" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Content Outputs" })).toBeVisible();
    await expect(page.getByText("WeChat Draft", { exact: true })).toBeVisible();
    await expect(page.getByText("X Drafts", { exact: true })).toBeVisible();

    const wechatEmpty = page.getByText("No WeChat draft yet.", { exact: false });
    const wechatPre = page.locator("pre").filter({ hasText: /./ }).first();
    await expect(wechatEmpty.or(wechatPre)).toBeVisible();

    const xEmpty = page.getByText("No X drafts yet.", { exact: false });
    const xArticle = page.locator("article").first();
    await expect(xEmpty.or(xArticle)).toBeVisible();
  });
});
