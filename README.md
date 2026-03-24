# MUHUB

Next.js 15 全栈应用：项目展示、社媒与 GitHub 快照（Prisma + PostgreSQL）。

## 启动方式

前置：Node.js 20+、[pnpm](https://pnpm.io) 9+。

```bash
pnpm install
cp .env.example .env
# 编辑 .env，至少配置 DATABASE_URL（仅访问 /projects/demo 时可暂不配置数据库）
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

未配置 `DATABASE_URL` 时，首页、创建项目页与 `/projects/demo` 仍可正常使用；其他 slug 会走数据库查询，无库或无记录时返回 404。

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

在 `push` / `pull_request` 至 `main` 或 `master` 时依次执行：

`pnpm install` → `lint` → `typecheck` → `prisma generate` → `build`（使用占位 `DATABASE_URL`）→ 安装 Playwright Chromium → `pnpm test:e2e`。

## Vercel 说明（预览与生产）

1. 在 Vercel 关联 GitHub 仓库，框架选 **Next.js**，包管理器选 **pnpm**（仓库根目录已提供 `vercel.json` 的 `installCommand`）。
2. 在 Project → Settings → Environment Variables 中为 **Preview / Production** 配置：
   - `DATABASE_URL`：Vercel Postgres 或其他 PostgreSQL 连接串。
   - `NEXT_PUBLIC_APP_URL`：部署 URL（如 `https://xxx.vercel.app`），供前端绝对链接使用。
   - `GITHUB_TOKEN`（可选）：后续对接 GitHub API 时使用。
3. Build Command 使用仓库默认的 `pnpm build`（已包含 `prisma generate`）。首次部署后对已有数据库执行迁移（例如在本地对生产库 `prisma migrate deploy`，或使用 Vercel 的 post-deploy hook）。

预览部署（Preview Deployment）在每次 Push 至开启 PR 的分支时自动生成；确保预览环境同样配置上述变量。

## 路由一览

| 路径 | 说明 |
|------|------|
| `/` | 首页 |
| `/dashboard/projects/new` | 创建项目（静态表单占位） |
| `/projects/[slug]` | 项目详情；`demo` 为内置演示数据 |

## 文档

- [本地与环境搭建](docs/runbooks/dev-setup.md)
- [回归测试说明](docs/runbooks/regression.md)
