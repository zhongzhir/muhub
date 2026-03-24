# MUHUB

Next.js 15 全栈应用：创业项目数据镜像与展示（Prisma + PostgreSQL）。**不包含**评分、推荐、融资、支付或链上能力。

## 当前已实现的业务链路（V1 第 1 轮）

1. 访问 **`/dashboard/projects/new`**，填写表单并点击 **「创建项目」**。
2. 服务端校验（必填、`slug` 格式与唯一性、可选 URL），将 **Project** 与 **ProjectSocialAccount** 写入 PostgreSQL。
3. 成功后跳转到 **`/projects/[slug]`**，从数据库读取并展示项目（无数据库或未命中时，`demo` slug 仍可使用内置演示数据兜底）。

单人开发态：无登录、无权限系统，所有创建入口均为开放表单（请勿暴露于公网生产环境而不加保护）。

## 启动方式

前置：Node.js 20+、[pnpm](https://pnpm.io) 9+。

```bash
pnpm install
cp .env.example .env
# 编辑 .env：真实创建与详情读库需要 DATABASE_URL
pnpm dev
```

开发服务器默认 <http://127.0.0.1:3000>。

其他常用命令：

```bash
pnpm build          # prisma generate + next build（生产构建）
pnpm start          # 启动生产服务（需先 build）
pnpm lint           # ESLint
pnpm typecheck      # TypeScript 检查
pnpm test:e2e       # Playwright 全量 E2E
pnpm test:smoke     # Playwright 冒烟（仅首页）
```

## 如何创建项目并验证写入

1. 配置可用的 **`DATABASE_URL`**，并执行迁移（见下节）。
2. 浏览器打开 **`/dashboard/projects/new`**，填写 **项目名称**、**slug**（小写字母、数字、短横线）及可选字段。
3. 提交后应跳转到 **`/projects/<slug>`**，页面头部显示项目名称、slug、状态、创建时间，**项目介绍**区显示你填写的内容（若为空则提示「暂无项目介绍」）。
4. **自动化验证**：在设置好 `DATABASE_URL` 的机器上执行 `pnpm build && pnpm test:e2e`，会运行 **`tests/e2e/create-project.spec.ts`**（无 `DATABASE_URL` 时该用例会被 **skip**）。CI 中使用容器内 PostgreSQL，始终执行完整链路。

## 数据库初始化

1. 准备 PostgreSQL，在 `.env` 中设置 `DATABASE_URL`（参见 `.env.example`）。
2. 应用迁移：

   ```bash
   pnpm exec prisma migrate deploy
   ```

   本地开发可使用：

   ```bash
   pnpm exec prisma migrate dev
   ```

3. （可选）Prisma Studio：`pnpm exec prisma studio`

未配置 `DATABASE_URL` 时：首页、`/projects/demo` 仍可访问；**提交创建**会提示未配置数据库；非 `demo` 的详情 slug 无法从库读取时会 404。

## 测试方式

- **E2E**：默认会拉起本地服务（非 CI 用 `pnpm dev`，CI 用 `pnpm start`，需先执行 `pnpm build`）。
- **冒烟**：`pnpm test:smoke`，仅验证首页。

```bash
pnpm build
pnpm test:e2e
```

若已手动启动 `pnpm dev`，可跳过 Playwright 内置服务：

```bash
set PLAYWRIGHT_SKIP_WEBSERVER=1   # Windows PowerShell: $env:PLAYWRIGHT_SKIP_WEBSERVER=1
pnpm test:e2e
```

## CI 说明

工作流：`.github/workflows/ci.yml`。

在 `push` / `pull_request` 至 `main` 或 `master` 时：

1. 启动 **PostgreSQL 16** 服务容器。
2. 设置 **`DATABASE_URL`** 指向该实例。
3. 依次执行：`pnpm install` → `lint` → `typecheck` → `prisma generate` → **`prisma migrate deploy`** → `pnpm build` → 安装 Playwright Chromium → **`pnpm test:e2e`**（含创建项目写库用例）。

## Vercel 说明（预览与生产）

1. 在 Vercel 关联 GitHub 仓库，框架选 **Next.js**，包管理器选 **pnpm**（仓库根目录已提供 `vercel.json` 的 `installCommand`）。
2. 在 Project → Settings → Environment Variables 中为 **Preview / Production** 配置：
   - `DATABASE_URL`：Vercel Postgres 或其他 PostgreSQL 连接串。
   - `NEXT_PUBLIC_APP_URL`：部署 URL（如 `https://xxx.vercel.app`），供前端绝对链接使用。
   - `GITHUB_TOKEN`（可选）：后续对接 GitHub API 时使用。
3. Build Command 使用仓库默认的 `pnpm build`（已包含 `prisma generate`）。首次部署后对目标库执行 **`prisma migrate deploy`**。

预览部署在每次 Push 至 PR 分支时生成；请为预览环境配置数据库或接受创建接口不可用。

## 路由一览

| 路径 | 说明 |
|------|------|
| `/` | 首页 |
| `/dashboard/projects/new` | 创建项目（Server Action 写入数据库） |
| `/projects/[slug]` | 项目详情；优先读库，`demo` 无库时兜底演示数据 |

## 文档

- [本地与环境搭建](docs/runbooks/dev-setup.md)
- [回归测试说明](docs/runbooks/regression.md)
