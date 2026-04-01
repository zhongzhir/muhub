# Discovery 候选 → 正式 Project：导入与写入规则

本文说明 **`DiscoveryCandidate`** 经运营操作进入 **`Project`** 后的字段与关联写入（以 `lib/discovery/import-candidate.ts` 与 `lib/discovery/sync-discovery-to-project.ts` 为准）。

## 路径概览

```text
DiscoveryCandidate
    →（审核 Approve）→ 新建 Project + 外链 + 标记候选已导入
    →（合并 Merge）→ 更新已有 Project + 外链 + 候选 MERGED / IMPORTED
```

- **Accept**（分类语义）：常指 **接受 Classification 建议**（`classificationStatus=ACCEPTED`），将建议类型/标签合并回候选的 `categoriesJson` / `tagsJson`，**不**单独创建项目。
- **Import**：通常指 **Approve 导入** 为 **新** `Project`（默认 **草稿**、**不自动上广场** 等以代码为准）。

## 新建项目（Approve 导入）

- **基础字段**：`name`、`slug`（由 `allocateUniqueProjectSlug`）、`tagline`、`description`、`tags`、`logoUrl`（候选头像）、`websiteUrl`、`githubUrl`。
- **溯源**：`sourceType`、`discoverySource` / `discoverySourceId`、`discoveredAt`、`importedFromCandidateId`。
- **可见性**：默认 **`visibilityStatus=DRAFT`**、非公开等（以 Prisma 写入为准）。

### categories / tags / primary

- 通过 **`projectCreateClassificationSlice`** 等与候选 **`categoriesJson` / `suggestedType` / classification 接受态** 对齐；**仅在接受分类等条件下** 写入项目的 `categoriesJson`、`primaryCategory`、`isAiRelated`、`isChineseTool`（见 `sync-discovery-to-project.ts`）。

### externalLinks

- **`buildCoreCandidateLinkSpecs`**：从候选 **repo、website、docs、twitter、youtube** 以及 **Product Hunt**（`externalType=producthunt_product` 时 **`externalUrl`）生成 **`ProjectExternalLink`**。
- **Enrichment**：**已接受**的 enrichment 链接通过 **`buildAcceptedEnrichmentLinkSpecs`** 合并写入，`source` 标记为 enrichment 来源常量。

### flags

- 指项目的 **`isAiRelated` / `isChineseTool`** 等：与候选分类及合并策略 **`mergeDiscoveryBoolField`** 一致，**不强行覆盖** 已有明确 false（见 sync 工具函数）。

## 合并至已有项目（Merge）

- 更新目标 **`Project`** 的 `tags`、可选 `categoriesJson` / `primaryCategory` / 布尔字段（在分类已接受时）。
- **外链**：同样通过 `buildCoreCandidateLinkSpecs` 与接受的 enrichment 规格 **去重追加**。
- 候选侧：`reviewStatus=MERGED`，`importStatus=IMPORTED`，`matchedProjectId` 指向目标项目。

## 与「Accept」的区分（避免混淆）

| 操作 | 对象 | 结果 |
|------|------|------|
| 接受 **Classification** | 候选 | 更新候选 `categoriesJson` / `tagsJson`，`classificationStatus=ACCEPTED` |
| **Approve 导入** | 候选 + 新 Project | 新建项目 + 外链 + 候选 APPROVED/IMPORTED |
| **Merge** | 候选 + 已有 Project | 更新项目 + 外链 + 候选 MERGED |

## 相关文档

- [Discovery 架构](../discovery/discovery-architecture.md)
- [Discovery 来源](../discovery/discovery-sources.md)
