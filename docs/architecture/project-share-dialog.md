# 项目分享弹窗（`ProjectShareDialog`）

面向 **详情页**与 **Dashboard 项目页**的轻量分享入口，与独立页面 **`/projects/[slug]/share`**（分享名片页）并存：**弹窗负责快速复制与发帖入口**，名片页负责整页对外展示与截图传播。

## 版本与范围

| 版本 | 日期（文档记录） | 摘要 |
|------|------------------|------|
| **V1.2** | — | 三种文案模板、复制链接/文案、Twitter intent、`ProjectShareCard` 预览 |
| **V1.2.1** | 2026-03-28 | 预览语义强化、复制成功分层反馈、**本设备** localStorage 计数、操作区顺序与文案打磨 |

**约束**：不修改数据库与后端 API；不新增 npm 依赖；统计仅为浏览器 `localStorage`，**非全站真实数据**。

## 入口与数据流

- **公开详情**：`app/projects/[slug]/page.tsx` → `ProjectHeroPublicActions` → `ProjectShareDialog`（`open` 状态在当地）。
- **工作台**：`app/dashboard/projects/[slug]/page.tsx` → `ProjectWorkspace` → 同上。
- 传入 props 含：`slug`、`name`、`tagline`、`shareSnippet`、`canonicalUrl`、可选 `description`（社群模板正文摘抄来源，与页面 `descriptionForShare` 一致）。

## 文案模板（`lib/share/project-share-templates.ts`）

| `ShareTemplateId` | UI 标签 | 用途 |
|-------------------|---------|------|
| `short` | 简短 | 默认中文短帖 + 链接 |
| `community` | 社群 | 多行介绍 + `descriptionLine` |
| `twitter` | 英文 | 与 Twitter intent 一致的英文短句 |

工具函数：`getShareTextByTemplate`、`resolveCommunityDescriptionBody`、`buildTwitterIntentUrl`、`buildTwitterShareText`。

## 本机分享计数（V1.2.1）

- **模块**：`lib/share/project-share-local-metrics.ts`
- **存储键**：`muhub:project-share:v1:` + `encodeURIComponent(storageId)`
- **`storageId`**：`slug.trim()` 优先；若为空则对 `canonicalUrl` 解析 **`host + pathname`**（解析失败则退回 URL 字符串或占位），保证键稳定。
- **结构**：JSON `{ "copyLink": number, "copyText": number, "twitter": number }`
- **行为**：复制链接成功 / 复制文案成功 / 用户点击「Twitter / X」各 `+1`；读写入均 `try/catch`，损坏或不可用时视为 0，**不得导致弹窗崩溃**。
- **展示**：弹窗底部弱化文案，明确 **「本设备」**；无记录时提示首次在本设备分享；有记录时显示累计操作次数（三类之和）。

## UI 结构顺序（V1.2.1）

1. 标题 / 副标题  
2. **分享效果预览**说明 + `ProjectShareCard`  
3. **文案风格**分段按钮（简短 / 社群 / 英文）  
4. **当前将复制的文案**（只读滚动区）  
5. **复制链接**、**复制文案**、**Twitter / X**  
6. 复制成功时的 **inline 状态区**（链接与文案两套副文案）  
7. 复制失败时的 `ManualCopyTextarea` 降级  
8. 本机计数弱提示  
9. 项目名片/海报占位（后续能力）

## 相关文件

| 路径 | 说明 |
|------|------|
| `components/project/project-share-dialog.tsx` | 弹窗主组件 |
| `components/project/project-share-card.tsx` | 弹窗内卡片预览（非 Canvas 导出） |
| `lib/share/project-share-templates.ts` | 模板与 Twitter URL |
| `lib/share/project-share-local-metrics.ts` | 本机计数读写 |

## 回归与 E2E

- 独立分享页仍以 **`tests/e2e/share-project.spec.ts`** 等为 **`/projects/.../share`** 主路径。
- 弹窗可用手工验收：`data-testid="project-share-panel"`、`project-share-copy-link`、`project-share-copy-text`、`project-share-twitter`、`project-share-card`。
