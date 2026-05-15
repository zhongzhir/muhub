# Non-GitHub 收录回归 Runbook

## 适用范围

当 MUHUB 调整项目收录、创建、发布、前台展示或 e2e 流程时，用于快速确认：

- 无 GitHub 项目仍可创建、编辑、发布、展示；
- 现有 GitHub 项目链路不被破坏；
- CI 中 `pnpm test:e2e` 出现回归时可快速定位。

## 本轮已固化的产品规则

- GitHub 不是项目收录必填项。
- 项目创建最小条件：项目名称 +（至少一个公开来源链接 或 项目介绍）。
- 项目发布不要求 GitHub；无 GitHub 时“代码仓库数据”模块展示空态，不影响其余模块。
- 公开来源可来自官网、平台页、公众号文章来源、媒体报道、GitCC、外部链接等。

## 本轮关键实现点（供回归核对）

- `app/dashboard/projects/new/actions.ts`
  - 创建校验：无 GitHub 也可通过（需公开来源或介绍）。
- `lib/admin-project-edit.ts`
  - 发布校验：不再把 GitHub 作为阻塞项。
- `components/project/project-detail-info-sections.tsx`
  - 无 GitHub 时仍显示“代码仓库数据”模块空态。
- `docs/discovery/project-admission-and-lifecycle.md`
  - 规则与生命周期基准文档。

## e2e 经验沉淀（高频坑）

### 1) 创建后跳转超时（`waitForProjectSlugAfterCreate`）

典型报错：

- `page.waitForURL ... Test timeout`

常见原因：

- 测试只填了项目名称，未满足新的最小创建条件（无公开来源且无介绍），导致实际上未提交成功。

处理原则：

- 相关 e2e 创建步骤至少填一项：`description` / `tagline` / `websiteUrl`。

### 2) `role="alert"` strict mode 冲突

典型报错：

- strict mode violation，`getByRole("alert")` 命中业务错误提示 + `__next-route-announcer__`。

处理原则：

- 避免全局 `getByRole("alert")`，优先收窄到业务容器内（如表单区域）。
- 或改为更稳定的 API 级断言（见第 4 点）。

### 3) 文案变更导致测试失败

典型报错：

- 断言“暂无仓库快照数据”失败，实际文案改为“暂无代码仓库数据”。

处理原则：

- 对 UI 空态文案建立单一来源；文案调整时同步更新 e2e。

### 4) 认领流程浏览器端偶发网络异常

典型报错：

- 页面提示“网络异常，提交失败，请稍后重试。”

处理策略（已采用）：

- 在 e2e 中使用 `page.request.post("/api/projects/{slug}/claim")` 直接验证认领 API 结果，绕过浏览器端偶发 fetch 抖动。

## 推荐的回归顺序

1. `corepack pnpm typecheck`
2. `corepack pnpm lint`
3. `corepack pnpm build`
4. `corepack pnpm test:e2e`

若 e2e 失败，优先看是否为以下三类：

- 创建条件不满足（表单未真正提交）；
- 选择器过宽（alert / heading 文案）；
- 页面文案同步遗漏（空态文案变化）。

## 最小验证清单（非 GitHub）

- 无 GitHub + 官网 URL 可创建草稿。
- 无 GitHub 项目可进入编辑页。
- 无 GitHub 项目可发布。
- 前台详情页不报错，代码仓库模块显示空态。
- GitHub 项目刷新/展示链路仍正常。
