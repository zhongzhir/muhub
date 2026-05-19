# 日常运营命令

MUHUB 的日常维护以 `pnpm` 脚本和数据库迁移为主。生产环境变量以根目录 `.env.example` 为准。

## 统一调度：`cron:all`

```bash
pnpm cron:all
```

`cron:all` 会依次执行以下任务，并在每一步输出开始、完成、失败和耗时日志：

1. `pnpm run ai:update`
2. `pnpm run source:update`
3. `pnpm run summary:update`
4. `pnpm run tracker:official-info`

单个步骤失败不会阻塞后续步骤继续运行。全部步骤跑完后，`cron:all` 会汇总失败步骤并以非 0 状态退出，便于 pm2 / crontab 日志和告警识别。

## 分项脚本

### `pnpm run ai:update`

- 脚本：`scripts/run_ai_update.ts`
- 用途：对比 GitHub/Gitee 与库内最新仓库快照；必要时写入新快照、Release/活跃度类动态；并批量补全 `Project.aiCardSummary`。
- 依赖：`DATABASE_URL`；外网可访问代码托管 API；可选 `GITHUB_TOKEN` 提额。

### `pnpm run source:update`

- 脚本：`scripts/source_update.ts`
- 用途：遍历含 `WEBSITE` / `BLOG` / `DOCS` 信息源的活跃项目，抓取页面标题等公开信号并写入 `ProjectUpdate`，按 URL 去重。
- 依赖：`DATABASE_URL`；目标 URL 可访问。

### `pnpm run summary:update`

- 脚本：`scripts/summary_update.ts`
- 用途：对活跃项目生成 AI Weekly Summary，写入 `ProjectWeeklySummary`。
- 依赖：`DATABASE_URL` + `OPENAI_API_KEY`。

### `pnpm run tracker:official-info`

- 脚本：`scripts/run-project-info-tracker.ts`
- 名称：项目官方信息补全与公开信号跟踪雏形。
- 用途：扫描已公开项目的官网、GitHub、公众号、微博、抖音等来源缺口；通过 OpenAI 兼容模型尝试补全高置信官方来源；补全成功时写入 `ProjectSource` 和一条系统 `ProjectUpdate`。
- 注意：这不是“全网自动跟踪”，当前没有接入搜索引擎或搜索 API。
- 依赖：`DATABASE_URL`；`AI_API_KEY` / `AI_MODEL` / `AI_BASE_URL`，或 `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL_INSIGHT` / `DEEPSEEK_BASE_URL`。
- 可选：`TRACKER_LIMIT` 控制单次最多处理项目数；`TRACKER_SPACING_MS` 控制项目间隔。
- 日志：每次运行输出 `checked` / `updated` / `skipped` / `errors`，可直接通过 pm2 / crontab 日志查看。

## 阿里云调度建议

服务器上建议用 crontab 或 pm2 执行：

```bash
cd /path/to/muhub && pnpm cron:all >> logs/cron-all.log 2>&1
```

如果只验证 tracker：

```bash
cd /path/to/muhub && TRACKER_LIMIT=3 pnpm run tracker:official-info
```

## 数据库迁移

```bash
pnpm exec prisma migrate deploy
```

本地开发可使用 `pnpm exec prisma migrate dev`；生产环境只使用 `deploy`。

## 健康检查

```bash
curl -sS https://<your-domain>/api/health
```

期望返回：`{"status":"ok"}`。
