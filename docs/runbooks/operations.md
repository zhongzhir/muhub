# 日常运营命令

MUHUB 无重型运营后台，日常维护以 **pnpm 脚本** 与数据库迁移为主。环境变量见根目录 **`.env.example`** 与 **README**「Deployment」。

## 统一调度：`cron:all`

```bash
pnpm cron:all
```

- **作用**：在同一进程中**依次**执行：
  1. **`pnpm run ai:update`**
  2. **`pnpm run source:update`**
  3. **`pnpm run summary:update`**
- **前置**：**`DATABASE_URL`** 必填；脚本通过 **`node --env-file=.env`** 加载本地环境。
- **典型用途**：服务器 crontab 每日/每周跑一次，保持快照、信息源动态与周总结相对新鲜。

## 分项脚本

### `pnpm run ai:update`

- **脚本**：`scripts/run_ai_update.ts`
- **用途**：对比 GitHub/Gitee 与库内最新仓库快照；必要时写入新快照、Release/活跃度类动态；并批量补全 **`Project.aiCardSummary`**（需 **`OPENAI_API_KEY`** 时效果完整）。
- **依赖**：**`DATABASE_URL`**；外网访问代码托管 API；可选 **`GITHUB_TOKEN`** 提额。

### `pnpm run source:update`

- **脚本**：`scripts/source_update.ts`
- **用途**：遍历含 **WEBSITE / BLOG / DOCS** 信息源的活跃项目，抓取页面标题等并写入 **`ProjectUpdate`**（按 URL 去重）。
- **依赖**：**`DATABASE_URL`**；目标 URL 可访问。

### `pnpm run summary:update`

- **脚本**：`scripts/summary_update.ts`
- **用途**：对活跃项目生成 **AI Weekly Summary**，写入 **`ProjectWeeklySummary`**。
- **依赖**：**`DATABASE_URL`** + **`OPENAI_API_KEY`**（未配置时多数项目会被跳过）。

## 种子项目导入

适合冷启动广场数据：

```bash
pnpm exec prisma migrate deploy
pnpm import:seed
```

- **数据**：`data/seed-projects.json`。
- **幂等**：已存在 **slug** 会跳过。
- **详情**：[`seed-import.md`](./seed-import.md)。

## 数据库迁移（生产）

```bash
pnpm exec prisma migrate deploy
```

本地开发可用 **`pnpm exec prisma migrate dev`**（会交互），生产环境只用 **`deploy`**。

## 健康检查

```bash
curl -sS https://<你的域名>/api/health
# 期望: {"status":"ok"}
```

## 其他常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 本地开发 |
| `pnpm build` / `pnpm start` | 生产构建与启动 |
| `pnpm lint` / `pnpm typecheck` | 代码质量 |
| `pnpm test:e2e` / `pnpm test:smoke` | Playwright |

上线前完整检查项见 **[`release-checklist.md`](./release-checklist.md)**。
