# MUHUB

**中文品牌：木哈布。** 站点与对外介绍以「木哈布」为主；仓库与文档中可继续使用代号 MUHUB。

Next.js 15 全栈应用：**AI Native 项目展示与多源动态聚合**（Prisma + PostgreSQL）。面向统一呈现项目名片、仓库与信息源、动态时间线，以及 **AI 摘要与周总结**；**不包含**站内评分、投融资交易、支付或链上能力。

## Beta 说明与功能总览

**MUHUB 当前为 Beta**：能力会持续迭代，欢迎用 **公开仓库项目** 试用并反馈。

| 模块 | 内容 |
|------|------|
| 项目 | 创建、**GitHub 导入**、**Gitee**（创建页 URL + 快照）、**仓库认领** |
| 信息源 | 官网 / 文档 / 博客 / 社媒等与仓库合并展示（`ProjectSource`） |
| 动态 | 手动发布、Release、信息源抓取、AI 运营动态等多来源 |
| AI | 项目摘要卡（`aiCardSummary`）、动态 **AI 摘要**、**Weekly Summary** |
| API | **`GET` / `POST /api/ai/project`**：传入 `githubUrl` 返回整合 JSON（详见 **[`docs/architecture/ai-api.md`](docs/architecture/ai-api.md)**） |
| 运维 | **`pnpm cron:all`**（`ai:update` → `source:update` → `summary:update`）；健康检查 **`GET /api/health`** |

**环境与部署提要**：变量见 **`.env.example`**；部署步骤见下文 **「Deployment（上线）」** 与 **[`docs/runbooks/release-checklist.md`](docs/runbooks/release-checklist.md)**；日常脚本见 **[`docs/runbooks/operations.md`](docs/runbooks/operations.md)**。

## 当前已实现的业务链路（V1 第 1 轮）

1. 访问 **`/dashboard/projects/new`**，填写表单并点击 **「创建项目」**。
2. 服务端校验（必填、`slug` 格式与唯一性、可选 URL），将 **Project** 与 **ProjectSocialAccount** 写入 PostgreSQL。
3. 成功后跳转到 **`/projects/[slug]`**，从数据库读取并展示项目（无数据库或未命中时，`demo` slug 仍可使用内置演示数据兜底）。

单人开发态：无登录、无权限系统，所有创建入口均为开放表单（请勿暴露于公网生产环境而不加保护）。

## V1 第 2 轮：项目广场与搜索

- **`/projects`（项目广场）**：从数据库读取 **`isPublic = true`** 的项目，按 **`createdAt` 倒序** 展示卡片；支持 **`?q=`** 查询参数，对 **名称、slug、一句话介绍** 做 **不区分大小写** 的 **模糊匹配**（Prisma `contains` + `insensitive`）。
- 无公开项目时提示 **「暂无公开项目」**，并展示 **「推荐项目」** 冷启动卡片（内置 Vercel / Supabase 等示例，点击可打开对应 **`/projects/[slug]`** 的只读示例详情，数据不写库；详情页提供 **「认领项目」** → **`/dashboard/projects/new?from=recommended&slug=...`** 预填创建表单）。
- 有搜索词但无匹配时提示 **「没有找到匹配的项目」**（不展示推荐池，以免干扰搜索结果）。
- 未配置 **`DATABASE_URL`** 时列表为空（同「暂无公开项目」**+ 推荐池**），不影响页面打开与搜索框展示。

## V1 第 3 轮：项目编辑

- **`/dashboard/projects/[slug]/edit`**：从数据库读取项目并 **预填表单**，**slug 只读不可改**；可修改名称、简介、链接、社媒（留空保存会 **删除** 该平台记录）、**是否公开**（checkbox）、**状态**（草稿 / 已发布 / 已归档）。保存通过 **Server Action** 写入数据库，成功后跳回 **`/projects/[slug]`**。
- **详情页**（数据库来源）顶部提供 **「编辑项目」** 链接；内置 **demo** 兜底页无此链接。
- **`isPublic` 与广场**：将项目设为 **非公开展示** 后，**仍可通过 URL 直接打开详情**；**`/projects` 广场不再列出该项目**（查询条件 `isPublic: true`）。请在 README 与回归文档中按此验收。

## V1.1 第 4 轮：从 GitHub 导入项目

- 访问 **`/dashboard/projects/import`**，粘贴 **GitHub 仓库 URL**（支持 `https://github.com/owner/repo`、`/` 结尾、`.git` 后缀），点击 **「导入项目」**。
- 服务端解析 **owner/repo**，请求 **`GET https://api.github.com/repos/{owner}/{repo}`**，将 **`name` → 项目名称**、**`description` → 一句话介绍**、**`html_url` → GitHub URL**、**`homepage` → 官网 URL**（若有），通过 **query** 跳转到 **`/dashboard/projects/new?...`** 预填表单（**不自动填充 slug / 项目介绍 / 社媒**）。
- 可选环境变量 **`GITHUB_TOKEN`**：作为 `Authorization: Bearer`，提升未认证请求的 **API 速率上限**；**非 OAuth，仅需 fine-grained / PAT 只读公开库即可**。
- **不参与自动同步或 OAuth 登录**；**stars / forks / owner** 已在 `lib/github.ts` 解析备用，当前不落库（创建页无对应字段）。
- **CI E2E**：工作流设置 **`GITHUB_IMPORT_E2E_FIXTURE=1`**，对固定测试仓库 **`muhub/e2e-fixture`** 使用内置数据，**无需访问外网**。本地跑完整导入用例可：`GITHUB_IMPORT_E2E_FIXTURE=1 pnpm test:e2e`。

## V1.1 第 5 轮：项目认领

- **详情页**（仅数据库来源）：**未认领**且已填 **GitHub URL** 时显示 **「认领该项目」**，进入 **`/projects/[slug]/claim`**。
- **认领页**：输入与项目 **`githubUrl`** **同一仓库** 的地址（解析后比对 **owner/repo**，大小写不敏感）；成功后 **`claimStatus = CLAIMED`**，写入 **`claimedAt`**、**`claimedBy`**（`owner/repo`），跳回详情并显示 **「已认领」**。
- **错误**：格式错误、**地址与项目不匹配**、**该项目已被认领**、项目未绑定 GitHub 时有明确中文提示。使用 **`updateMany`（`claimStatus: UNCLAIMED`）** 降低并发双认领概率。**无登录、无权限系统**。
- 新建项目默认 **`UNCLAIMED`**；迁移见 **`prisma/migrations/*/project_claim`**。

## V1.1 第 6 轮：项目分享卡片

- **`/projects/[slug]/share`（分享 / 项目名片）**：与详情同源，**`max-w-xl`**，面向 **商务展示、社交传播、截图转发**；顶部 **深色名片头**（**Logo URL** 或 **项目名首字母** 占位）、**项目名称（主标题）**、**tagline**、**状态标签**（**推荐项目** / **已认领项目** / 库内 **发布状态**）、**GitHub 精简指标**（有快照时 Stars / Forks / Issues）、**链接与创建时间**、**社媒概览**（数量 + 平台标签）、**最近 1～2 条动态**（标题 + **统一来源文案** + 时间）、**关于项目**（`line-clamp` 压缩长文）、底部 **「复制分享链接」** 主按钮；成功复制后 **按钮与 `role=status` 提示「已复制链接」**（无剪贴板权限时显示重试类文案）。
- **详情页** 顶部 **「分享项目」** 链至分享页（略加粗以示入口）。
- **自动化**：**`tests/e2e/share-project.spec.ts`** 走 **`/projects/demo/share`**（无库亦可）；复制步骤兼容剪贴板受限环境。

## V1 第 26 轮：分享页体验升级（亮点优先）

- **定位**：分享页由「数据罗列」调整为 **项目名片 / 对外介绍**，适合投资人、合作方与客户；**价值与进展在前，指标在后**，不删减能力仅 **重组层级**。
- **顺序**：**Hero**（名称、tagline、来源/状态徽章、Logo 或首字）→ **项目亮点**（优先 **`aiCardSummary`**，其次 **`description`**，再 **`tagline`**；可切段展示；技术标签 chips 附于亮点区）→ **当前进展**（优先 **`aiWeeklySummary`**，否则 **最近 1～2 条动态**（含摘要），再否则 **release/提交** 线索 + 温和占位）→ **项目信息源**（仓库 / 官网 / 文档 / 博客等快捷卡片 + **社媒**）→ **仓库指标参考**（Stars / Forks / Issues、最近提交、活跃度，**后置说明性文案**）→ **复制分享链接** CTA。
- **实现**：**`app/projects/[slug]/share/page.tsx`**、**`lib/share-project-view.ts`**（`buildShareHighlightParagraphs`、`buildShareProgressModel` 等）、**`components/project/share-highlight-section.tsx`**、**`components/project/share-progress-section.tsx`**。
- **回归**：**`tests/e2e/share-project.spec.ts`** 与 **`docs/runbooks/regression.md`**「分享名片页」。

## V1.2 / V1.2.1：项目分享弹窗（详情与 Dashboard）

- **入口**：公开详情 **`/projects/[slug]`**（`ProjectHeroPublicActions`）与工作台 **`/dashboard/projects/[slug]`**（`ProjectWorkspace`）的 **「分享项目」**，打开 **`ProjectShareDialog`**（`data-testid="project-share-panel"`）。**不替代**整页 **`/projects/[slug]/share`**（名片页仍用于对外长版与截图）。
- **V1.2**：三种复制文案模板（**简短 / 社群 / 英文**，`lib/share/project-share-templates.ts`）；**复制链接**、**复制文案**、**Twitter / X**（`intent/tweet`）；弹窗内 **`ProjectShareCard`** 为 UI 级预览（非服务端出图）。
- **V1.2.1（2026-03-28，仅前端）**：预览区上方说明「分享效果预览」；复制成功后区分 **链接 / 文案** 的轻量 **inline** 反馈；**本设备** **`localStorage`** 累计 **复制链接 / 复制文案 / 打开 Twitter**（键前缀 **`muhub:project-share:v1:`**，按项目 `slug` 或规范化 URL 隔离），底部弱化展示并标明本地视角；操作顺序为 **预览 → 文案风格 → 当前将复制正文 → 操作按钮**；无新依赖、不改数据库与 API。
- **实现**：**`components/project/project-share-dialog.tsx`**、**`components/project/project-share-card.tsx`**、**`lib/share/project-share-templates.ts`**、**`lib/share/project-share-local-metrics.ts`**；页面侧见 **`app/projects/[slug]/page.tsx`**、**`app/dashboard/projects/[slug]/page.tsx`**。
- **说明全文**：[`docs/architecture/project-share-dialog.md`](docs/architecture/project-share-dialog.md)。

## V1.1 第 7 轮：项目动态

- **`/dashboard/projects/[slug]/updates/new`（发布项目动态）**：填写 **标题**、**内容**，点击 **「发布」** 写入 **`ProjectUpdate`**（`sourceType = MANUAL`，字段 **`title` / `content` / `createdAt`**；历史来源仍可保留 **`summary`** 等）。
- **`/projects/[slug]` 详情页**：**「项目动态」** 区块展示最近动态，按 **`createdAt` 倒序**；数据库来源的详情/编辑页提供 **「发布动态」** 入口。
- **自动化**：**`tests/e2e/project-updates.spec.ts`**（需 **`DATABASE_URL`** 与迁移（含 **`ProjectUpdate` 多源字段**）；无库时 **skip**）。

## V1.1 第 8 轮：GitHub 数据手动刷新

- **详情页 `/projects/[slug]`**：**「GitHub 数据」** 区块展示 **`GithubRepoSnapshot`** 中 **`fetchedAt` 最新一条**；尚无快照时文案 **「暂无 GitHub 数据」**。
- **「刷新 GitHub 数据」**：仅当项目来自数据库且已配置 **`githubUrl`** 时显示；提交后调用 GitHub REST API（解析 owner/repo），**每次成功刷新新增一条快照**（保留历史），随后 **`redirect` 回详情页**。
- **抓取字段**（第一版）：`repoFullName`、`default_branch`、`stargazers_count`、`forks_count`、`open_issues_count`、watchers（优先 `subscribers_count`，否则兼容字段）、`pushed_at`（或补充一次 commits 列表取最近提交时间）作为 **最近仓库活动**，`contributors` 为可选第二请求（失败或 `/contributors` 不可用时为 0）；**`commitCount7d` / `commitCount30d`** 本轮仍写入 0，结构可扩展。
- **错误提示**：未配置 **`githubUrl`** → **「未配置 GitHub 仓库地址」**；URL 无法解析 → **「GitHub 地址格式错误」**；API 404 → **「未找到该 GitHub 仓库」**；其他 API/网络/写库失败 → **「GitHub 请求失败，请稍后再试」**。
- **`GITHUB_TOKEN`（可选）**：与导入相同，作为 `Authorization: Bearer`，提高未认证请求的 **API 速率上限**；非 OAuth。
- **E2E**：**`tests/e2e/github-refresh.spec.ts`** 在 **`GITHUB_IMPORT_E2E_FIXTURE=1`** 或 **`GITHUB_REFRESH_E2E_FIXTURE=1`** 时对 **`muhub/e2e-fixture`** 走内置数据（**不访问外网**，与导入策略一致）；CI 已设置前者。

## V1 第 16 轮：项目详情页（产品化布局）

**`/projects/[slug]`** 采用 **单层信息架构**，自上而下：

1. **顶部 Hero**（`components/project/project-detail-hero.tsx`）：**`h1` 项目名称**、**tagline**、**徽章**（推荐项目 / 已认领 / 发布状态）、**仓库与官网外链**、**操作按钮组**（分享项目、编辑项目、发布动态、认领入口等）、**slug / 创建时间**、返回首页；推荐项目仍保留 **`recommended-project-hint`** 与 **`claim-recommended-button`** 供认领流程使用。
2. **仓库数据**：卡片展示平台、Stars、Forks、Issues、Watchers、最近提交、最新版本、活跃度；无快照时 **「暂无仓库快照数据」**；库内项目可 **刷新仓库数据**。
3. **项目动态**：标题栏右侧 **发布动态**；列表卡片层级（类型 pill、时间、`h3` 标题、正文/摘要）；空态 **「暂无项目动态」**。
4. **社媒**：**pill** 式条目；空态 **「暂无社媒信息」**。
5. **项目介绍**：独立卡片区；空态 **「暂无项目介绍」**。

页面容器约 **`max-w-5xl`**，业务能力与 **`data-testid`**（如 **`github-snapshot-section`**、**`project-updates-section`**）保持兼容现有 E2E。

## V1 第 17 轮：项目来源与状态（统一标签）

在产品各页统一展示 **「来源」** 与 **「状态/生命周期」** 两类 **Badge**（`lib/project-badges.ts` + `components/project/project-badge-strip.tsx`），中文文案一致：

**来源（择一主标签 + 可选精选）**

- **推荐项目**：未入库的推荐池详情（`recommended-projects` slug）。
- **种子项目**：入库且 **`Project.sourceType === "seed"`**（批量导入脚本）。
- **仓库导入**：入库且 **`sourceType === "import"`**（自 **`/dashboard/projects/import`** 跳转创建并提交）。
- **手工创建**：其它入库项目（含历史 **`sourceType` 为空**，创建时默认 **`manual`**）。
- **演示**：仅内置 **`demo` 兜底**  slug。
- **精选**：入库且 **`isFeatured === true`**（与上列可并存）。

**状态 / 生命周期**

- **草稿 / 已发布 / 已归档**：来自 **`Project.status`**。
- **已认领 / 未认领**：仅 **库内项目** 显示认领状态。

**页面**：**`/projects`** 卡片、**`/projects/[slug]`** Hero、**`/projects/[slug]/share`** 名片头均使用同一套规则；详情页已认领仍通过 **`project-claimed-label`** 挂到对应 badge 上以便 E2E。

## V1 第 18 轮：多源动态架构（第一版）

- **目标**：在不删改既有「发布动态 / 列表 / E2E」行为的前提下，统一 **ProjectUpdate** 的来源表达与详情「动态流」展示，并为 **社交媒体 / 官网 / AI 摘要** 等预留字段。
- **模型（最小迁移）**：`ProjectUpdate` 增加 **`sourceLabel`**（可选）、**`metaJson`**（可选 JSON 文本）、**`isAiGenerated`**（默认 `false`）；枚举增加 **`OFFICIAL`**、**`AI`**。历史数据无新列时等价于旧行为。
- **产品层来源（展示映射）**：**manual** / **repo** / **social** / **official** / **ai** / **system** ← 由 `sourceType`（及 `isAiGenerated`）推导；**`sourceLabel`** 优先作为 badge 主文案。
- **工具模块**：**`lib/project-updates.ts`**（映射、文案、`buildProjectUpdateStreamModel`）、**`lib/project-update-badges.ts`**（再导出）。
- **详情 `/projects/[slug]`**：「项目动态」为 **时间线式动态流**（`project-update-item`、`project-update-source-badge`）；保留 **「发布动态」**；有 **`sourceUrl`** 时 **「查看来源」** 外链。
- **手工发布**：**`/dashboard/projects/[slug]/updates/new`** 写入 **`sourceLabel: 手动发布`** 等，详情展示 **手动发布** 徽章。
- **分享 `/projects/[slug]/share`**：**最近动态** 行内 **`share-recent-update-source`** 与详情同一套 label 规则。
- **文档**：**`docs/architecture/project-updates.md`** 说明后续如何接仓库/社媒/官网/AI（本轮不接 API、队列与 Webhook）。
- **迁移**：`prisma/migrations/*/project_update_multisource`；部署前执行 **`pnpm exec prisma migrate deploy`**。

## V1 第 19 轮：AI Native 第一阶段

- **能力**：在 **不引入 Agent / 队列** 的前提下，使用 OpenAI Chat Completions（**`OPENAI_API_KEY`**，可选 **`OPENAI_BASE_URL` / `OPENAI_MODEL`**）生成 **项目介绍**、**导入项目标签**、**仓库/官方类动态摘要**；未配置 key 时 **静默跳过**，创建与刷新 **不报错**。
- **项目简介**：`**import**` / **`seed**` 来源且 **`description`** 为空时，**`createProject`** 与 **`pnpm import:seed`** 后异步补全（**`lib/ai/enrich-project.ts`**）。
- **标签**：**`Project.tags`**（`text[]`）；仅 **`import`** 且已填 **`githubUrl`**、标签为空时生成 3～5 个短标签。
- **动态摘要**：手动 **刷新仓库快照** 若出现 **新的 Release 标签**（相对上一次快照），写入一条 **`GITHUB`** 动态并异步生成 **`summary` + `isAiGenerated`**（**`lib/github-sync.ts`** + **`lib/github-release-update.ts`**）；**不覆盖** `title` / `content` / `sourceType`。
- **实现入口**：**`lib/ai/project-ai.ts`**（`generateProjectDescription`、`generateProjectTags`、`generateUpdateSummary`）；动态摘要应用 **`lib/ai/update-summary-ai.ts`**。
- **UI**：**`isAiGenerated`** 时并列 **来源** + **「AI摘要」** 徽章，正文下 **「AI 摘要：」** 段落；详情与分享页展示 **`project-tags`**。
- **文档**：**`docs/architecture/project-ai.md`**。
- **迁移**：**`prisma/migrations/*/project_tags`**；部署前 **`pnpm exec prisma migrate deploy`**。
- **E2E**：**`tests/e2e/ai-native-ui.spec.ts`**（演示页徽章/摘要/标签；无 key 时创建项目仍成功）。

## V1 第 20 轮：AI 自动运营机制（第一阶段）

- **脚本**：**`pnpm ai:update`** → **`scripts/run_ai_update.ts`**，遍历近期 **有仓库快照** 的活跃项目，对比 **GitHub/Gitee** 与库内最新快照；有 **Release** 或 **提交时间** 变化则 **追加快照** 并可能写入 **Release 动态** 或 **「AI 更新」活跃度动态**（**7 天**冷却）；另批量补全 **`Project.aiCardSummary`**（无 **OPENAI_API_KEY** 时摘要卡步骤跳过，动态仍可模板降级）。
- **实现**：**`lib/ai/project-ai-cron.ts`**（`checkProjectUpdates`、`refreshProjectAiCardSummaries`）、**`fetchLiveRepoSnapshotForUrl`**（**`lib/github-sync.ts`**）、**`generateRepoActivityCronLine` / `generateProjectHeroCardSummary`**（**`lib/ai/project-ai.ts`**）。
- **健康度**：**`lib/project-health.ts`** 的 **`computeProjectHealth`**（与 **`computeGithubActivity`** 一致：**活跃项目 / 持续维护 / 低活跃**），详情 Hero **`project-health-badge`**。
- **摘要卡**：**`aiCardSummary`** 展示于 Hero 下方 **`project-ai-summary`**（迁移 **`project_ai_card_summary`**）。
- **文档**：**`docs/architecture/ai-operations.md`**。
- **E2E**：**`tests/e2e/ai-operations-ui.spec.ts`**（演示页 health + 摘要卡；不依赖外网 API key）。

## V1 第 21 轮：项目信息源系统（多信息源架构）

- **模型**：**`ProjectSource`**（`ProjectSourceKind`：GITHUB / GITEE / WEBSITE / DOCS / BLOG / TWITTER），一条项目多行；**保留** **`githubUrl` / `websiteUrl`**，展示层 **`getProjectSources`** 与表数据 **去重合并**。
- **工具**：**`lib/project-sources.ts`**（`getProjectSources`、`normalizeSourceType`、`mapSourceLabel`、`inferRepoSourceKind` 等）。
- **创建项目**：**`/dashboard/projects/new`** 可填 **Gitee（第二仓库）**、**文档**、**博客**、**X/Twitter 主页**，写入 **`ProjectSource`**；种子脚本 **`import:seed`** 同步写入仓库 + 官网信息源。
- **详情 UI**：**`project-sources-section`**（卡片列表 + 轻量符号、**主源** 标记）；无数据 **空态**。
- **文档**：**`docs/architecture/project-sources.md`**。
- **迁移**：**`prisma/migrations/*/project_sources`**。
- **E2E**：**`tests/e2e/project-sources.spec.ts`**、**`create-project.spec.ts`** 断言信息源区与「文档」文案。

## Deployment（上线）

面向生产或预发环境，建议按下列顺序收口：

1. **环境变量**（参见根目录 **`.env.example`**）
   - **`DATABASE_URL`**：PostgreSQL 连接串（`sslmode=require` 等按托管方要求）。
   - **`OPENAI_API_KEY`**（可选）：AI 简介、标签、动态摘要、周总结、项目 API 等；不配则相关能力静默降级。
   - **`NEXTAUTH_SECRET`**（可选占位）：若后续接入 NextAuth 用于会话签名；请使用足够长的随机串，**勿提交真实 `.env`**。
   - **`NEXT_PUBLIC_APP_URL`**：站点根 URL（如 `https://your-domain.com`）。
   - **`GITHUB_TOKEN`**（可选）：提高 GitHub REST 速率上限，只读公开库即可。

2. **数据库**
   - 首次或新版本部署后执行：**`pnpm exec prisma migrate deploy`**。
   - **本地开发重建库（会清空数据）**：**`pnpm db:reset`**（`prisma migrate reset --force`）。

3. **构建与启动**
   - **`pnpm install`** → **`pnpm build`** → **`pnpm start`**（或使用 Vercel / 其他平台的等价命令）。

4. **健康检查**
   - **`GET /api/health`** → **`{ "status": "ok" }`**，供负载均衡、Uptime 探针使用（不访问数据库）。

5. **定时任务（运营脚本）**
   - 在宿主机或 Cron Job 中按需执行：**`pnpm cron:all`**，将依次运行 **`ai:update`** → **`source:update`** → **`summary:update`**（均需 **`DATABASE_URL`**；后两者对 AI key / 外网有依赖时可部分跳过，见各脚本日志）。
   - 也可拆分单独配置 crontab 调用各 `pnpm run …`。

6. **托管说明**
   - **Vercel**：见下文「Vercel 说明」；Build 使用仓库 **`pnpm build`**，并在目标数据库上执行 **`prisma migrate deploy`**。
   - 其他 Node 宿主：保证 **Node.js 20+**、启动前 **`prisma generate`**（已含在 **`postinstall` / `build`** 中亦可）。

## 启动方式

前置：Node.js 20+、[pnpm](https://pnpm.io) 9+。

```bash
pnpm install
cp .env.example .env
# 编辑 .env：将 DATABASE_URL 等替换为你的真实连接串（.env.example 仅为占位符，勿把真实密码提交进仓库）
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
pnpm ai:update      # AI 运营：快照对比 + 可选动态/摘要卡（需 DATABASE_URL）
pnpm source:update  # 信息源抓取写入动态（需 DATABASE_URL）
pnpm summary:update # AI 周总结（需 DATABASE_URL；OPENAI_API_KEY）
pnpm cron:all       # 依次执行 ai:update → source:update → summary:update
pnpm db:reset       # 开发用：prisma migrate reset --force（清空数据）
```

## 如何创建项目并验证写入

1. 配置可用的 **`DATABASE_URL`**，并执行迁移（见下节）。
2. 浏览器打开 **`/dashboard/projects/new`**，填写 **项目名称**、**slug**（小写字母、数字、短横线）及可选字段。
3. 提交后应跳转到 **`/projects/<slug>`**，**Hero 区**显示项目名称与「项目主页」标签、slug 与创建时间；**项目介绍**区显示你填写的内容（若为空则提示「暂无项目介绍」）。
4. **自动化验证**：在设置好 `DATABASE_URL` 的机器上执行 `pnpm build && pnpm test:e2e`，会运行 **`tests/e2e/create-project.spec.ts`**（无 `DATABASE_URL` 时该用例会被 **skip**）。CI 中使用容器内 PostgreSQL，始终执行完整链路。

## 如何编辑项目

1. 确保已配置 **`DATABASE_URL`** 且执行过 **`prisma migrate deploy`**。
2. 打开 **`/dashboard/projects/<slug>/edit`**（或在 **数据库来源** 的项目详情页点击 **「编辑项目」**）。
3. 修改字段后点击 **「保存修改」**，成功后将回到 **`/projects/<slug>`**，详情与广场（若仍为公开）将显示最新内容。
4. 自动化：**`tests/e2e/edit-project.spec.ts`** 覆盖「创建 → 编辑 → 保存 → 详情断言」（无 **`DATABASE_URL`** 时 **skip**）。

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

未配置 `DATABASE_URL` 时：首页、**`/projects`**、`/projects/demo` 仍可访问；**提交创建**会提示未配置数据库；非 `demo` 的详情 slug 无法从库读取时会 404。

## 冷启动：批量导入种子项目

面向上线初期：**不写后台导入页、不做定时任务**，用脚本一次性灌入示例项目。

- **数据文件**：根目录 **`data/seed-projects.json`**（数组；每项至少含 **`name` / `slug` / `tagline` / `repoUrl`**，可选 **`websiteUrl`、 `description`、`isFeatured`、`sourcePlatform`、`sourceType`**）。内置多条 GitHub 与 Gitee 混合示例，可按需增删。
- **执行**（需 **Node.js 20+**，以便 **`--env-file`** 加载 `.env`）：

  ```bash
  pnpm exec prisma migrate deploy   # 确保含 isFeatured / sourceType 等迁移
  pnpm import:seed
  ```

  脚本会复用 **`parseRepoUrl`** 校验 **`repoUrl`**，将规范化地址写入 **`Project.githubUrl`**；**`slug` 已存在则跳过**；非法仓库地址跳过并打日志；结束时打印**成功 / 跳过 / 失败**计数。
- **导入后如何验证**：
  1. 浏览器打开 **`/projects`**，列表中应出现种子项目卡片（按 **`isPublic`** 与创建时间排序，与手动创建一致）。
  2. 点击任意种子 **`slug`**（如 **`/projects/pytorch`**）进入详情，仓库链接与文案正确。
  3. 再次执行 **`pnpm import:seed`**，控制台应大量 **「已存在同 slug」** 跳过，统计 **成功 0、跳过 N**（幂等）。
- **自动化（轻量）**：不强制跑全库写入；可运行 **`pnpm exec playwright test tests/e2e/seed-projects-json.spec.ts`**，仅校验种子 JSON 条数、GitHub/Gitee 混合、**`repoUrl` 均可解析**。
- **详细 runbook**：[`docs/runbooks/seed-import.md`](docs/runbooks/seed-import.md)。

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
3. 依次执行：`pnpm install` → `lint` → `typecheck` → `prisma generate` → **`prisma migrate deploy`** → `pnpm build` → 安装 Playwright Chromium → **`pnpm test:e2e`**（Job 内设置 **`GITHUB_IMPORT_E2E_FIXTURE=1`**；含认领、创建/编辑写库、**GitHub 刷新 fixture** 等用例）。

## Vercel 说明（预览与生产）

1. 在 Vercel 关联 GitHub 仓库，框架选 **Next.js**，包管理器选 **pnpm**（仓库根目录已提供 `vercel.json` 的 `installCommand`）。
2. 在 Project → Settings → Environment Variables 中为 **Preview / Production** 配置：
   - `DATABASE_URL`：Vercel Postgres 或其他 PostgreSQL 连接串。
   - `NEXT_PUBLIC_APP_URL`：部署 URL（如 `https://xxx.vercel.app`），供前端绝对链接使用。
   - `GITHUB_TOKEN`（可选）：**导入仓库**、**详情页「刷新 GitHub 数据」**等 GitHub REST 调用可提高 API 限额；勿提交到仓库。
3. Build Command 使用仓库默认的 `pnpm build`（已包含 `prisma generate`）。首次部署后对目标库执行 **`prisma migrate deploy`**。

预览部署在每次 Push 至 PR 分支时生成；请为预览环境配置数据库或接受创建接口不可用。

## 路由一览

| 路径 | 说明 |
|------|------|
| `/` | 首页 |
| `/dashboard/projects/import` | 从 GitHub 导入并跳转创建页预填 |
| `/dashboard/projects/new` | 创建项目（支持 `?name=&tagline=&githubUrl=&websiteUrl=` 预填） |
| `/dashboard/projects/[slug]/edit` | 编辑项目（预填表单、保存后回详情） |
| `/dashboard/projects/[slug]/updates/new` | 发布项目动态（标题 + 正文，写入 ProjectUpdate） |
| `/projects` | 项目广场：公开项目列表与搜索（`?q=`） |
| `/projects/[slug]` | 项目详情（Hero → 仓库数据 → 项目动态 → 社媒 → 介绍）；优先读库，`demo` 无库时兜底演示数据 |
| `/projects/[slug]/share` | 分享名片页（亮点优先、当前进展、信息源、后置仓库指标、复制链接） |
| `/projects/[slug]/claim` | 仓库地址核验认领（需已绑定 GitHub URL） |
| `/api/health` | 健康检查 JSON `{ "status": "ok" }` |
| `/api/ai/project` | POST/GET：`githubUrl` → 项目整合 JSON（[AI API 文档](docs/architecture/ai-api.md)） |

## 文档

- [项目分享弹窗（详情 / Dashboard）](docs/architecture/project-share-dialog.md)
- [本地与环境搭建](docs/runbooks/dev-setup.md)
- [回归测试说明](docs/runbooks/regression.md)
- [冷启动种子导入](docs/runbooks/seed-import.md)
- [上线检查清单](docs/runbooks/release-checklist.md)
- [日常运营命令](docs/runbooks/operations.md)
- [AI 项目 API（/api/ai/project）](docs/architecture/ai-api.md)
