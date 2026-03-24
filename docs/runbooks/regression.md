# 回归测试（Playwright）

## 覆盖范围

测试文件位于 `tests/e2e/`。

| 用例文件 | 说明 |
|----------|------|
| `regression.spec.ts` | 首页「MUHUB」、创建项目页标题「创建项目」、`/projects/demo` 文案「项目主页」（`exact: true`，避免与标语子串冲突） |
| `smoke.spec.ts` | 冒烟：仅验证首页标题 |
| `create-project.spec.ts` | **创建项目闭环**：填写 `/dashboard/projects/new` 表单 → 提交 → 跳转 `/projects/[slug]` → 断言 **项目名称**、**项目主页**、**项目介绍**正文（需 **`DATABASE_URL`** 且已迁移；未配置时 **skip**） |

## 创建项目链路如何回归

1. 准备：PostgreSQL + `.env` 中 `DATABASE_URL` + `pnpm exec prisma migrate deploy`。
2. 执行：`pnpm build && pnpm test:e2e`（或本地 `pnpm dev` 已起时直接 `pnpm test:e2e`，勿设 `CI=1`）。
3. 检查页面元素（与 `create-project.spec.ts` 一致）：
   - 表单：`#name`、`#slug`、`#tagline`、`#description`、`#githubUrl`、`#websiteUrl`、社媒字段、`创建项目` 按钮。
   - 提交后 URL 为 `/projects/e2e-<时间戳>`。
   - 详情页：一级标题为填写的项目名称；可见文案 **项目主页**（精确）；可见填写的 **项目介绍** 段落。

CI 中通过 Job 级 **PostgreSQL 服务** 与 **`prisma migrate deploy`** 保证上述用例不 skip。

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

GitHub Actions 中设置 `CI=true`，Playwright 使用 `pnpm start`，因此流水线中 **必须先 `pnpm build`**。Job 内提供 PostgreSQL 与 `DATABASE_URL`，与本地「有库」场景一致。

## 调试

- 查看报告：`pnpm exec playwright show-report`
- 追踪文件：失败用例可能在 `test-results/` 下生成 `trace.zip`，使用 `pnpm exec playwright show-trace <path>` 查看

## 扩展建议

新增关键页面时，在 `regression.spec.ts` 增加断言；发布前快速验证可只跑 `pnpm test:smoke`。
