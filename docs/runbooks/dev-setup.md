# 开发环境搭建（MUHUB）

## 依赖

- Node.js **20.x**（与 CI 一致）
- **pnpm** 9.x（见仓库 `pnpm-lock.yaml`）
- **PostgreSQL**（可选：仅在使用非 `demo` 的项目详情或写入数据时需要）

## 克隆与安装

```bash
git clone <repository-url>
cd MUHUB
pnpm install
```

复制环境变量模板并填写：

```bash
cp .env.example .env
```

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串，`postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public` |
| `NEXT_PUBLIC_APP_URL` | 浏览器可访问的应用根 URL |
| `GITHUB_TOKEN` | 预留：调用 GitHub API（如拉取仓库快照） |

## 数据库

首次同步 schema 到数据库：

```bash
pnpm exec prisma migrate deploy
```

本地迭代模型时：

```bash
pnpm exec prisma migrate dev --name <描述>
```

## 开发服务器

```bash
pnpm dev
```

使用 Turbopack；修改 `app/`、`prisma/schema.prisma` 等后按需重启或重新生成客户端：

```bash
pnpm exec prisma generate
```

配置好数据库并迁移后，可在 **`/dashboard/projects/new`** 创建项目，并在 **`/projects/<slug>`** 查看写入结果（单人开发态，无认证）。

## 常见问题

- **Prisma Client 过期**：改 schema 后执行 `pnpm exec prisma generate`。
- **pnpm 禁止依赖构建脚本**：仓库已在 `package.json` 中配置 `pnpm.onlyBuiltDependencies`，若克隆后仍报错，可重新执行 `pnpm install`。
