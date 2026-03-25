# 项目动态（ProjectUpdate）多源架构

第一版目标：在数据库与展示层统一「来源」语义，便于后续接入 GitHub/Gitee Release、社媒、官网 RSS/Changelog、AI 摘要等，而无需重构核心列表结构。

## 数据层（Prisma）

- **`sourceType`（`ProjectUpdateSourceType`）**：权威分类枚举。
  - `MANUAL` → 产品层 **manual**
  - `GITHUB` → **repo**（未来可辅以 `metaJson` 区分 Gitee 等宿主）
  - `SOCIAL` → **social**
  - `SYSTEM` → **system**
  - `OFFICIAL` → **official**（官网 / 博客 / Changelog）
  - `AI` → **ai**（可与 `isAiGenerated` 配合）
- **`sourceLabel`**（可选）：覆盖默认中文 badge 文案（如「Gitee Releases」「官方博客」）。
- **`sourceUrl`**：外链（Release、帖子、文章等）。
- **`metaJson`**（可选，文本存 JSON）：同步任务 ID、原始 payload、平台专用字段等。
- **`isAiGenerated`**：显式标记 AI 产出；展示上通常与 **ai** 样式一致。

历史行：`sourceLabel` / `metaJson` / `isAiGenerated` 为空或默认时，行为与旧版一致。

## 展示层

- **`lib/project-updates.ts`**：`mapSourceTypeToOrigin`、`getUpdateStreamPrimaryLabel`、`buildProjectUpdateStreamModel`（badge 类名 + 主文案）。
- **`lib/project-update-badges.ts`**：对上述模块的再导出，供页面按路径引用。

手工发布：`publishProjectUpdate` 写入 `sourceType: MANUAL`、`sourceLabel: "手动发布"`、`isAiGenerated: false`。

## 后续接入建议（不在当前里程碑实现）

| 方向 | 建议 |
|------|------|
| GitHub / Gitee Release | 定时或 Webhook 拉取 → `sourceType: GITHUB` 或后续扩展枚举；`sourceUrl` 指向 Release；`metaJson` 存 tag、compare URL |
| 社交媒体 | `sourceType: SOCIAL`；`sourceLabel` 平台名；`metaJson` 存 post id |
| 官网 / RSS | `sourceType: OFFICIAL`；`sourceUrl` 文章链接 |
| AI 摘要 | `sourceType: AI` 或 `MANUAL` + `isAiGenerated: true`；正文存摘要 |

禁止在生产环境暴露写接口前，仍未加鉴权与速率限制（与产品安全策略一致）。
