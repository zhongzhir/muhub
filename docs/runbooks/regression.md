# 回归测试（Playwright）

## 覆盖范围

测试文件位于 `tests/e2e/`。

| 用例文件 | 说明 |
|----------|------|
| `regression.spec.ts` | 首页「MUHUB」、创建项目页标题「创建项目」、`/projects/demo` 文案「项目主页」（`exact: true`，避免与标语子串冲突） |
| `smoke.spec.ts` | 冒烟：仅验证首页标题 |
| `create-project.spec.ts` | **创建项目闭环**：填写 `/dashboard/projects/new` 表单 → 提交 → 跳转 `/projects/[slug]` → 断言 **项目名称**、**项目主页**、**项目介绍**正文（需 **`DATABASE_URL`** 且已迁移；未配置时 **skip**） |
| `projects-list.spec.ts` | **项目广场**：`/projects` 标题「项目广场」、搜索框；**空列表或卡片**二选一（`projects-empty-all` **或** `project-card`）；**`/projects?q=demo`** 显示当前搜索词；**无匹配搜索词**出现 `projects-empty-search`（不依赖库内是否有数据） |
| `edit-project.spec.ts` | **编辑项目**：先创建项目 → 打开 **`/dashboard/projects/<slug>/edit`** → 修改名称与 tagline → **保存修改** → 回到详情页并看到新标题与标语（需 **`DATABASE_URL`**；无则 **skip**） |
| `import-github.spec.ts` | **GitHub 导入**：非 GitHub 域名 → **「GitHub 地址格式错误」**；若 **`GITHUB_IMPORT_E2E_FIXTURE=1`**：`muhub/e2e-fixture` → 跳转 **`/dashboard/projects/new`** 并预填字段（CI 默认开启 fixture；未设置时第二条 **skip**） |
| `claim-project.spec.ts` | **认领**：创建带 GitHub 的项目 → 详情 **认领该项目** → **`/projects/.../claim`** 填写一致 URL → 回详情见 **`project-claimed-label`**「已认领」（需 **`DATABASE_URL`**） |
| `project-updates.spec.ts` | **项目动态**：创建项目 → **`/dashboard/projects/<slug>/updates/new`** 填写标题与内容并 **发布** → 详情 **`project-updates-section`** 可见标题与正文（需 **`DATABASE_URL`** 与 **`ProjectUpdate.content` 迁移） |
| `github-refresh.spec.ts` | **GitHub 刷新**：创建带 **`muhub/e2e-fixture`** 的项目 → 详情 **「刷新 GitHub 数据」** → **`github-snapshot-section`** 可见 Stars/Forks 等（需 **`DATABASE_URL`** + **`GITHUB_IMPORT_E2E_FIXTURE=1`** 或 **`GITHUB_REFRESH_E2E_FIXTURE=1`**） |

## 认领如何回归

1. 创建或编辑项目，确保 **`githubUrl`** 已填且 **`claimStatus`** 为未认领。
2. 打开 **`/projects/<slug>`**，应见 **「认领该项目」**（仅库中项目；内置 demo 无此按钮）。
3. 进入认领页，**正确 URL** 提交 → 返回详情，标题下 **「已认领」**，按钮消失。
4. **错误**：故意填错仓库 → **「GitHub 地址与项目不匹配」**；已认领再访问认领页 → **「该项目已被认领」**。
5. 自动化：**`claim-project.spec.ts`**（无库时 **skip**）。

## GitHub 数据刷新如何回归

1. 准备：PostgreSQL + **`DATABASE_URL`** + 迁移；可选配置 **`GITHUB_TOKEN`** 以防匿名 API 限流。
2. 在编辑页为项目填写合法 **`githubUrl`**，保存后打开 **`/projects/<slug>`**。
3. **尚无刷新过**：**「GitHub 数据」** 内应显示 **「暂无 GitHub 数据」**；点击 **「刷新 GitHub 数据」** 成功后应出现 **Stars / Forks / Open Issues / Watchers**、**最近仓库活动**、**最近抓取时间**；再次刷新应更新 **最近抓取时间** 且库中 **`GithubRepoSnapshot`** 增加记录。
4. **错误**：删除或清空 **`githubUrl`** 后仅能通过编辑页再配置；故意填非法 URL 保存后点刷新 → **「GitHub 地址格式错误」**；私有或不存在仓库（视 API）→ **未找到该 GitHub 仓库** 或 API 失败类提示。
5. 自动化：**`github-refresh.spec.ts`**（CI 带 **`GITHUB_IMPORT_E2E_FIXTURE=1`** 时不依赖外网）。

## 从 GitHub 导入如何回归

1. 打开 **`/dashboard/projects/import`**，应见标题 **「从 GitHub 导入项目」** 与 **GitHub Repo URL** 输入框。
2. 填写非 `github.com` 的 URL 并提交 → 文案 **「GitHub 地址格式错误」**。
3. （可选）配置 **`GITHUB_TOKEN`** 后，用真实仓库地址导入 → 进入创建页且 **名称 / 标语 / GitHub / 官网** 已预填，**slug** 仍须手填。
4. 自动化：见 **`import-github.spec.ts`**；CI 带 **`GITHUB_IMPORT_E2E_FIXTURE=1`** 时不依赖外网。

## 编辑项目链路如何回归

1. 准备：同创建项目（PostgreSQL + **`DATABASE_URL`** + 迁移）。
2. 自动化：运行 **`pnpm test:e2e`**，确认 **`edit-project.spec.ts`** 通过（CI 中具备数据库，不 skip）。
3. 手动：在编辑页取消 **「在项目广场公开展示」** 并保存 → 打开 **`/projects`** 确认该项目 **不再出现** → 仍可直接访问 **`/projects/<slug>`** 查看详情。

## 修改公开状态如何回归

- **列表**：仅 **`isPublic === true`** 的项目出现在 **`/projects`**；改为非公开后应从列表消失。
- **详情**：本轮策略下 **不设防**，仍可通过 slug URL 访问，用于单人维护预览。

## 项目列表页如何回归

1. 打开 **`/projects`**，应见一级标题 **「项目广场」**、搜索输入（`aria-label` / `搜索项目`）与 **「搜索」** 按钮。
2. **有库无数据**：应见 **`data-testid="projects-empty-all"`**（暂无公开项目）；**有库有数据**（如 CI 在创建用例之后）：应至少见一张 **`data-testid="project-card"`** 卡片。
3. 打开 **`/projects?q=demo`**，应出现 **「当前搜索：」** 文案及关键词 **demo**。
4. 打开带不可能匹配词的搜索 URL（用例中为 `__no_such_project_xyz_123__`），应见 **`projects-empty-search`**（没有找到匹配的项目）。

## 搜索如何回归

- 手动：在列表页输入关键词并提交，地址栏应为 **`/projects?q=...`**，列表随 Prisma 条件过滤。
- 自动化：见 **`projects-list.spec.ts`** 中带参 URL 与无结果两条用例。

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
