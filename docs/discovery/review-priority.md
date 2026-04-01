# Discovery V2 — 审核优先级（reviewPriorityScore）

候选 **`reviewPriorityScore`** 与 **`reviewPrioritySignals`** 用于 **后台 `/admin/discovery`** 的排序与运营视图，由 **可解释规则** 计算（无大模型），代码见 `lib/discovery/review-priority.ts` 与持久化 `lib/discovery/persist-review-priority.ts`。

## 持久化与刷新时机

- 字段存于 **`DiscoveryCandidate.reviewPriorityScore`**（默认 `0`）、**`reviewPrioritySignals`**（JSON）。
- 在 **GitHub/Product Hunt upsert**、**Classification**（完成/失败）、**Enrichment**（成功/失败）、**接受分类**、**接受 Enrichment**、**导入/拒绝/忽略/合并** 等更新候选后 **重算并写回**。
- 历史数据可一次性格式化批量重算：管理端 **「重算审核优先级（批量）」**（按 `updatedAt` 较早优先，单次约 280 条可调）。

## 评分因子（与实现对齐）

下列为因子 **类型**说明；具体分值以代码中 `computeReviewPriority` 为准，可在同一函数内调权重。

| 因子维度 | 说明 |
|----------|------|
| **Multi source** | 多来源标签（如 GitHub + Product Hunt），或 Product Hunt 已并入 GitHub 行（`metadataJson.productHunt` + 仓库身份） |
| **Website** | 候选 `website` 非空 |
| **GitHub / 仓库** | `repoUrl` 非空 |
| **Docs** | `docsUrl` 非空 |
| **Classification** | `ACCEPTED` 高于 `DONE`；`FAILED` 小幅扣分 |
| **Enrichment** | `OK` 加分；`FAILED` 小幅扣分 |
| **Stars** | 仓库星标对数缩放（热度） |
| **Product Hunt votes** | 自 `metadataJson.productHunt.votesCount` 或 `snapshots[].votes` |
| **质量分合成** | 使用现有 `score` / `qualityScore` 的小额加成 |
| **AI 相关** | `isAiRelated === true` |
| **近期活动** | `repoUpdatedAt` / `lastCommitAt` 新近度 |

## 降权（审核终态）

- **REJECTED / IGNORED**：总分 **上限压低**（便于列表沉底）。
- **IMPORTED / MERGED**：总分 **上限压低**（已处理完毕，不占「待办」头部）。

## Signals（reviewPrioritySignals）

JSON 结构（版本化）包含：

- **`version`**：当前为 `1`
- **`total`**：与 **`reviewPriorityScore`** 一致（已含降权）
- **`multiSource`** / **`contributingLabels`** / **`productHuntFused`** / **`productHunt` `{ votes, snapshotCount, lastSyncIso }`**
- **`factors`**：`{ id, label, points }[]` — **逐项可解释**，便于运营理解「为什么这条分高」

详情页 `/admin/discovery/[id]` 展示 **因子分解** 与 **PH 融合** 摘要。

## 排序规则

- 列表/API：`sort=reviewPriority`（及 `order=desc|asc`）映射 Prisma **`orderBy: { reviewPriorityScore }`**，分页友好。
- 数据库索引：**`(reviewStatus, reviewPriorityScore DESC)`** 辅助待办场景查询。
- 「推荐审核」聚光灯区块在 **待办子集** 内取 Top N，避免全表扫描；见 `lib/discovery/discovery-review-spotlights.ts`。

## 相关文档

- [架构](./discovery-architecture.md)
- [来源与去重](./discovery-sources.md)
