# 回归测试（Playwright）

## 覆盖范围

测试文件位于 `tests/e2e/`。

| 用例文件 | 说明 |
|----------|------|
| `regression.spec.ts` | 首页「MUHUB」、创建项目页「创建项目」、`/projects/demo` 文案「项目主页」（精确匹配，避免与标语撞字） |
| `smoke.spec.ts` | 冒烟：仅验证首页标题 |

## 本地运行

生产模式（与 CI 接近）：

```bash
pnpm build
pnpm test:e2e
```

仅冒烟：

```bash
pnpm build
pnpm test:smoke
```

开发模式（由 Playwright 自动执行 `pnpm dev --turbopack`，无需先 build）：

```bash
# 勿设置 CI=1
pnpm test:e2e
```

## CI 行为

GitHub Actions 中设置 `CI=true`，Playwright 使用 `pnpm start`，因此流水线中 **必须先 `pnpm build`**。工作流已按此顺序编排。

## 调试

- 查看报告：`pnpm exec playwright show-report`
- 追踪文件：失败用例可能在 `test-results/` 下生成 `trace.zip`，使用 `pnpm exec playwright show-trace <path>` 查看

## 扩展建议

新增关键页面时，在 `regression.spec.ts` 增加断言；发布前快速验证可只跑 `pnpm test:smoke`。
