import { expect, test, type Page } from "@playwright/test";

const SESSION_COOKIE_NAME = "authjs.session-token";

function baseURLFromEnv(): string {
  return process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
}

/** 未配置时跳过当前用例（本地可不跑需登录链路） */
export function skipWithoutE2EAuthGate(): void {
  test.skip(
    !process.env.AUTH_SECRET?.trim() || !process.env.E2E_TEST_SECRET?.trim(),
    "需要 AUTH_SECRET 与 E2E_TEST_SECRET（见 .env.example；GitHub Actions 已注入）",
  );
}

/**
 * 注入 NextAuth JWT Cookie，无需真实 GitHub OAuth。
 * 依赖服务端 /api/e2e/auth-token（仅当 E2E_TEST_SECRET 与 DATABASE_URL 可用）。
 */
export async function loginAsE2EUser(page: Page): Promise<{ userId: string }> {
  skipWithoutE2EAuthGate();

  const baseURL = baseURLFromEnv();
  const res = await page.context().request.post(`${baseURL}/api/e2e/auth-token`, {
    headers: { "x-e2e-secret": process.env.E2E_TEST_SECRET! },
  });

  expect(
    res.ok(),
    `e2e auth-token 失败: HTTP ${res.status()} ${await res.text()}`,
  ).toBeTruthy();

  const body = (await res.json()) as { sessionToken: string; userId?: string; error?: string };
  expect(body.sessionToken, "响应缺少 sessionToken").toBeTruthy();
  expect(body.userId, "响应缺少 userId").toBeTruthy();

  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: body.sessionToken,
      url: baseURL,
    },
  ]);

  return { userId: body.userId! };
}
