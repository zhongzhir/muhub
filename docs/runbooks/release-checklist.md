# 上线前检查清单（Beta / 生产）

部署新版本或首次上线前建议逐项确认。详细命令见 [`operations.md`](./operations.md)。

## 环境与配置

- [ ] **`.env` / 托管平台变量**：已配置 **`DATABASE_URL`**；按需配置 **`OPENAI_API_KEY`**、**`GITHUB_TOKEN`**、**`NEXT_PUBLIC_APP_URL`** 等（参见根目录 **`.env.example`** 与主 **README**「Deployment」）。
- [ ] **密钥未提交**：`.env` 在 `.gitignore` 中，仓库内无真实密码。
- [ ] **Node / 包管理**：CI 与生产为 **Node.js 20+**、**pnpm**（与 `package.json` / CI 一致）。

## 数据库

- [ ] 在**目标**数据库执行 **`pnpm exec prisma migrate deploy`**，与当前 `prisma/migrations` 一致。
- [ ] （仅开发重建）勿在生产执行 **`pnpm db:reset`**。

## 构建与质量

- [ ] **`pnpm install`**
- [ ] **`pnpm run lint`**
- [ ] **`pnpm run typecheck`**
- [ ] **`pnpm run build`**

## 健康与 API

- [ ] **`GET /api/health`** 返回 **`{"status":"ok"}`**（不访问数据库）。
- [ ] **`GET` 或 `POST /api/ai/project`** 在提供有效 **`githubUrl`** 且外网可达时返回 JSON（未配 **`OPENAI_API_KEY`** 时仍可返回名称、指标与离线友好字段，见 [`../architecture/ai-api.md`](../architecture/ai-api.md)）。

## 核心业务路径（页面）

在浏览器或预发环境抽查（或依赖 E2E）：

- [ ] **首页** `/` 可打开；Beta 提示可见（轻量条）。
- [ ] **项目广场** `/projects` 可打开。
- [ ] **详情页** `/projects/demo` 或库内 slug 可打开。
- [ ] **分享页** `/projects/<slug>/share` 可打开。
- [ ] **创建项目** `/dashboard/projects/new` 表单可用（需 DB）。
- [ ] **导入项目** `/dashboard/projects/import` 流程可用（GitHub；fixture 见 CI）。
- [ ] **认领项目** `/projects/<slug>/claim` 流程可用（需 DB + 未认领 + GitHub URL）。
- [ ] **AI 项目摘要**：演示或已写库数据下 **`project-ai-summary`** / 摘要卡展示正常（无 key 时可无 AI 文案）。
- [ ] **AI Weekly Summary**：有 **`ProjectWeeklySummary`** 数据时详情/分享侧展示正常。

## 数据冷启动（可选）

- [ ] **`pnpm import:seed`** 在目标环境执行完毕且无异常（见 [`seed-import.md`](./seed-import.md)）。

## 定时任务（可选）

- [ ] 宿主机或 Cron 已配置 **`pnpm cron:all`**（或分别 **`ai:update`** / **`source:update`** / **`summary:update`**），且 **`DATABASE_URL`** 可用。

## 自动化测试

- [ ] CI 或通过：**`pnpm test:e2e`**（或至少 **`pnpm test:smoke`** + 核心业务用例）。

## 回归文档

- [ ] 发布后有增量时，更新 **README** 与 **`docs/runbooks/regression.md`** 中相关段落。

---

**说明**：勾选顺序可按团队流程调整；数据库备份与回滚策略由运维另行定义，本清单不替代安全审计。
