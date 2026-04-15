# MUHUB Playwright（上线前最小可用自动化验收）

本目录用于 **上线前第一轮自动化冒烟 + 关键路径验收**：优先验证“页面能打开、关键入口仍在、关键后台不被裸开放”。

这不是企业级测试体系：不追求全覆盖、不做截图对比、不做性能/安全扫描。

## 依赖安装

在项目根目录：

```bash
npm install
npx playwright install chromium
```

## 如何启动被测站点

推荐本地开发模式（与仓库现有 Playwright 配置一致）：

```bash
npm run dev
```

> 说明：根目录 `playwright.config.ts` 已配置 `webServer`（默认 `pnpm dev --turbopack`）。若你本地更习惯手动启动，也可设置环境变量 `PLAYWRIGHT_SKIP_WEBSERVER=1` 跳过自动拉起服务。

## 如何运行测试

### 上线前推荐组合（公开页 + admin + 项目详情）

```bash
npm run test:e2e:prelaunch
```

### 全部 E2E（仓库既有用例 + 新增用例）

```bash
npm run test:e2e
```

### 单个文件

```bash
npm run test:e2e:public
npm run test:e2e:admin
npx playwright test tests/e2e/project-page.spec.ts
```

### UI 模式 / headed（可选）

```bash
npm run test:e2e:ui
npm run test:e2e:headed
```

## Admin 测试与登录态（重要）

Admin 用例 **不依赖 GitHub OAuth 手工登录**，而是复用仓库既有方案：

- 配置 `AUTH_SECRET`、`DATABASE_URL`、`E2E_TEST_SECRET`
- 测试会调用 `POST /api/e2e/auth-token` 注入 `authjs.session-token`

同时，Admin 页面还需要满足 **管理员权限**（见 `.env.example`）：

### 方案 A（推荐：本地开发一键放行）

仅本地开发环境：

```bash
MUHUB_ADMIN_DEV_ALLOW_ALL=true
```

### 方案 B（推荐：白名单）

把 E2E 用户加入 `MUHUB_ADMIN_USER_IDS`。

测试会在 `POST /api/e2e/auth-token` 的响应里返回 `userId`（cuid），你可以：

1. 先跑一次 `npm run test:e2e:admin`（若失败会提示缺少白名单）
2. 或临时打印 `userId` 后写入 `.env`

> 若两者都不配置：admin 登录用例会自动 **skip**（稳定优先，不让整仓 e2e 脆弱失败）。

## 当前覆盖范围与限制

已覆盖：

- 公开页：`/`、`/projects`、`/terms` `/privacy` `/legal`
- admin：`/admin/discovery/items` 未登录拦截；在可配置条件下验证关键按钮与 Content Outputs 区块
- 项目详情：从 `/projects` 第一个卡片进入（无数据则跳过）

限制：

- 不做数据准备/复杂 fixture；项目详情用例在无项目数据时会跳过
- admin 强依赖本地 `.env` 配置（见上）；不满足则 skip
- 不做 CI/CD 集成（本任务范围外）
