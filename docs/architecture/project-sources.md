# 项目信息源（ProjectSource）

## 目标

在保留 **`Project.githubUrl` / `websiteUrl`** 的前提下，用 **`ProjectSource`** 表达「一个项目的多个外部入口」，为后续 **定时抓取、变更检测、AI 聚合** 提供统一挂载点。

## 数据模型（Prisma）

- **`ProjectSource`**：`projectId`、`kind`（枚举 **`ProjectSourceKind`**）、`url`、`label?`、`isPrimary?`
- **枚举**：`GITHUB` | `GITEE` | `WEBSITE` | `DOCS` | `BLOG` | `TWITTER`（社媒主页 URL，**不接 Twitter API**）

一个项目可有多条 `ProjectSource`；**主仓库**可用 `isPrimary` 标记（创建时 GitHub/Gitee 首条通常为 `true`）。

## 展示与兼容

- **`lib/project-sources.ts`**
  - **`getProjectSources`**：合并 **库内行** 与 **legacy 顶字段**（`githubUrl` / `websiteUrl`），按 URL + kind **去重**后排序（主源优先，其次固定 kind 顺序）。
  - **`normalizeSourceType`**：配置/导入用短字符串 → 枚举。
  - **`mapSourceLabel` / `mapSourceEmoji`**：详情列表文案与轻量图标。
  - **`inferRepoSourceKind`**：由仓库 URL 推断 `GITHUB` / `GITEE`。

- **详情页**：**`project-sources-section`**；无数据时 **空态**，不报错。

## 写入路径（当前）

- **`/dashboard/projects/new`**：GitHub / Gitee（第二仓库）/ 官网 / 文档 / 博客 / X·Twitter URL → 同步写入 **legacy 字段**（若适用）与 **`ProjectSource` 多行**。
- **`pnpm import:seed`**：种子项目写入 **仓库 + 官网** 对应 **ProjectSource**。

## 未来多源抓取（示意）

1. **轮询表**：以 **`ProjectSource.id`** 为粒度存 **`lastFetchedAt` / `contentHash` / `etag`**（可后续加列或旁路 `SourceFetchState` 表，避免本轮大改）。
2. **调度**：复用 **`pnpm ai:update`** 或独立 **`pnpm sources:sync`**，按 `kind` 分流 **Git REST / 站点 HEAD / RSS** 等（**禁止**在本轮接复杂爬虫或 Twitter 写权限 API）。
3. **产出**：检索结果进入 **`ProjectUpdate`**（`OFFICIAL` / `AI` 等）或 **运营摘要**，与现有多源动态架构对齐。
