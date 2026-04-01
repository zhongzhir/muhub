# Discovery V2 — 数据来源与接入规范

## 当前支持的来源

| 类型 | `DiscoverySource.type` | `subtype` 示例 | 默认 `key` 示例 |
|------|------------------------|----------------|-----------------|
| **GitHub** | `GITHUB` | `topic` | `github-topics` |
| **GitHub** | `GITHUB` | `trending` | `github-trending` |
| **Product Hunt** | `PRODUCTHUNT` | `featured` | `producthunt-featured` |
| **Product Hunt** | `PRODUCTHUNT` | `topic` | `producthunt-ai` |

配置落在 `DiscoverySource.configJson`（topics、排序、条数、PH 的 `PostsOrder`、topic slug、`featuredOnly` 等）。环境变量示例见仓库根目录 **`.env.example`**（如 `GITHUB_TOKEN`、`PRODUCTHUNT_ACCESS_TOKEN`）。

## 候选侧类型标识

- GitHub 路线：`externalType` 多为 `github`（以代码映射为准）。
- Product Hunt：`externalType` 为 **`producthunt_product`**，`externalId` / `externalUrl` 对应帖子；若网站指向 GitHub，可解析出 **`repoUrl`**。

## 去重规则（摘要）

实现分布于 `lib/discovery/upsert-candidate.ts`（GitHub）与 `lib/discovery/upsert-producthunt-candidate.ts`（Product Hunt）。原则：**高置信才合并，名称相似不强行合并**。

### GitHub

1. **`normalizedKey`** / **`dedupeHash`**（仓库维度规范化键）。
2. **`repoUrl`** 规范化后唯一命中已有候选。
3. Trending 模式可合并 `rawPayloadJson` 中的快照历史。

### Product Hunt

1. **`externalType=producthunt_product` + `externalId`**：同一 PH 帖子更新而非重复建。
2. **`normalizedKey` / `dedupeHash`**（如 `producthunt:{id}`）。
3. **`repoUrl`**：与已有 GitHub 候选对齐时，**合并到该 GitHub 行**，Product Hunt 信息写入 **`metadataJson.productHunt`**（含 `snapshots`）。
4. **官网域名**：规范化主机名，在有限窗口内 **仅唯一命中** 时合并；多命中则保留独立候选，交由人工。

### 与「repoUrl / website / externalId」的对应关系

| 信号 | 用途 |
|------|------|
| **`externalId`（+ `externalType`）** | Product Hunt 帖子级唯一；GitHub 侧可用 API id 字符串 |
| **`repoUrl`** | GitHub 仓库 URL 规范化去重 |
| **`website`** | 产品官网；PH 侧非 GitHub 的落地页；域名级辅助去重（保守） |

## 来源接入规范（新增来源 checklist）

1. **不破坏主流程**：新 `type`/`subtype` 仅在 `run-discovery-source.ts` 增加分支，**不删除**既有 GitHub/PH 逻辑。
2. **先入候选池**：抓取结果一律 **`DiscoveryCandidate`**，不直接写 `Project`。
3. **字段**：至少填充 `title`、`sourceKey`、稳定 `externalType`/`externalId`（若有）、`rawPayloadJson`；链接类字段尽量结构化。
4. **去重**：定义规范化键；与 GitHub / 官网 的合并策略写清楚并在 upsert 中实现。
5. **运行审计**：创建 `DiscoveryRun`，写入计数与 `logJson`。
6. **优先级**：upsert 末尾调用 **`persistReviewPriorityForCandidateId`**（或与现有写路径一致 triggers），保证列表可排序。
7. **文档**：更新本文「当前支持的来源」表格与 `discovery-architecture.md` 流程图。

## 相关文档

- [架构与数据流](./discovery-architecture.md)
- [审核优先级](./review-priority.md)
