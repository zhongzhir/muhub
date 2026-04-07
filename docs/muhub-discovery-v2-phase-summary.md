# MUHUB Discovery V2 阶段总结文档

> **文档性质**：工程阶段归档，面向研发与协作延续；非对外产品文案。  
> **范围说明**：下文「Discovery V2 / V2.1」特指本阶段交付的 **JSON Discovery Queue + Admin + Import Project** 最小闭环；与仓库内既有 **Prisma `DiscoveryCandidate` 候选池**（`/admin/discovery`）并存，见第 5.4 节。

---

## 1. 阶段目标

MUHUB 的第二层能力是 **AI 信息层**：需要稳定、可追溯的 **项目发现输入**，以支撑内容智能体编排、运营审核与平台增长归因。本阶段 **Discovery V2** 的目标 **不是** 建设大而全的自动发现平台，而是 **先建立最小可运行闭环**，在可控成本下验证「发现 → 审核 → 入库」是否可走通。

具体而言，本阶段要形成可工程化演示的路径：

**GitHub（Demo 输入）→ Discovery Queue → 人工 Review → Import → 正式 Project 库**

完成该闭环后，团队才具备在 AI 信息层上迭代「更多来源、更强元数据、更高自动化」的事实基础；未完成 Import 的发现流程无法对平台主数据产生实质价值，因此 **闭环优先于来源扩张**。

---

## 2. 本阶段完成内容

### 2.1 Discovery 数据结构

**类型定义**：`agents/discovery/discovery-types.ts` 中的 `DiscoveryItem`。

| 字段 | 说明 |
|------|------|
| `id` | 队列项唯一标识（写入时生成） |
| `sourceType` | 来源类型枚举，见下文 |
| `title` | 展示标题；Demo 场景下可与「owner/repo」形态一致 |
| `url` | 主链接；Demo 下为 GitHub 仓库 URL |
| `description` | 可选说明（Demo 为本地拼接文案，非 API 元数据） |
| `projectSlug` | 导入成功后回写的正式项目 `slug` |
| `status` | 审核/导入生命周期状态 |
| `createdAt` | ISO 时间字符串 |

**状态设计**（`DiscoveryStatus`）：

- `new`：新入队，待处理  
- `reviewed`：人工已浏览/认可，可导入  
- `imported`：已成功写入（或关联）正式 `Project`  
- `rejected`：明确不采纳；导入动作会拒绝，需先改回 `new` / `reviewed`

**`sourceType` 的设计意义**（`DiscoverySourceType`：`github` | `manual` | `rss` | `twitter` | `other`）：

- 当前 **实际写入路径** 以 **`github`**（Demo）为主；其余取值为 **预留枚举**，与后续 RSS、社媒等来源扩展对齐，避免未来改模型时大面积重构。  
- 导入正式项目时，`sourceType` 会进入 `Project.discoverySource` 等溯源字段，便于区分数据从何而来。

### 2.2 JSON Discovery Queue

- **本地存储位置**：仓库根目录下 `data/discovery-items.json`（JSON 数组）。  
- **为何本阶段使用 JSON 而非数据库**：  
  - 实施成本低、与现有 Next.js Server Action / 脚本读写路径简单；  
  - 快速验证「队列 + 审核 + 入库」产品与工程流程；  
  - **不替代**、**不迁移** 既有 Prisma `DiscoveryCandidate` 体系，降低并行改造风险。  
- **读写与容错**：  
  - 启动读写前会 `ensure` 目录与文件存在；解析失败时退化为空数组；  
  - 单条 `coerce` 失败则 **跳过该条**，不阻塞整文件加载。  
- **URL 去重**：`normalizeDiscoveryUrl`（去 hash、统一 host 小写、路径去尾斜杠等）后比较；**追加**时若 URL 已存在则标记 `duplicate`、**不写库**。  
- **排序**：读取后按 `createdAt` **字典序倒序**（新条目在前展示）。

### 2.3 GitHub Discovery Demo

- **脚本**：`pnpm discovery:items-demo` → `scripts/run-discovery-github-demo.ts`。  
- **能力边界**：仅支持 **手动/脚本内给定的 GitHub 仓库 URL** 构造 `DiscoveryItem` 并入队；**不接 GitHub API**，不拉取 stars、README、语言等实时元数据。  
- **作用**：证明「发现入口」在工程上可运行、可复现，并与 Admin 页、Import 动作串成闭环，而非建设生产级 GitHub 爬虫。

### 2.4 Admin 管理页

| 路径 | 职责 |
|------|------|
| `/admin/discovery` | **既有** Prisma **DiscoveryCandidate** 运营主界面（来源、候选、审核优先级、Approve/Merge 导入等） |
| `/admin/discovery/items` | **本阶段新增** **JSON Discovery Queue** 管理：列表、状态操作、**Import** |

**为何未覆盖 `/admin/discovery`**：  
数据库候选池页面职责已重（筛选、多来源、与 `approveDiscoveryCandidateImport` 等深度耦合）。JSON 队列是 **平行、轻量** 通道，单独路由避免搅乱现有生产工作流与权限心智。

**JSON 队列页承担职责**：

- 展示 `readDiscoveryItems()` 结果；  
- **Reviewed / Reject / Mark new**：调用 `updateDiscoveryStatus` 并 `revalidatePath`；  
- **Import**：调用 `importDiscoveryItemAction`，写入 `Project` 并回写 `imported` + `projectSlug`；`imported` 行展示公开页/后台编辑链接。

### 2.5 Import Project 闭环

- **入口**：`app/admin/discovery/items/actions.ts` 中的 `importDiscoveryItemAction`；核心领域逻辑在 `lib/discovery/import-json-queue-item.ts` 的 `importJsonDiscoveryItem`。  
- **与正式 Project 的映射**（最小集）：  
  - `title` → `Project.name`  
  - `description` → `tagline`（过长截断）+ `description`  
  - `url` → 按解析结果写入 `githubUrl` / `websiteUrl`，并创建对应 `ProjectSource`（GitHub / Gitee / WEBSITE），与 Dashboard 创建项目的数据习惯对齐  
  - `slug` → `allocateUniqueProjectSlug`（与全站项目 slug 分配策略一致）  
  - `sourceType` / `id` / `createdAt` → `discoverySource`、`discoverySourceId`、`discoveredAt`；`sourceType` 库存字段为 `discovery-json-queue`  
- **复用的现有逻辑**：`allocateUniqueProjectSlug`、`normalizeGithubRepoUrl`、候选导入相近的默认发布字段（`ACTIVE` + `visibilityStatus: DRAFT` + `isPublic: false`）、以及可选 `scheduleProjectAiEnrichment`（与既有 enrich 管线对齐）。  
- **幂等与去重**（原则简述）：  
  - 已为 `imported` 且 `projectSlug` 对应项目仍存在 → **不新建**；  
  - 按 **规范化后的 GitHub / 官网 URL**、Gitee `ProjectSource`、以及**标题推导的基础 slug** 等与库中项目保守匹配 → **关联既有项目**，只更新 JSON 状态；  
  - `rejected` 禁止导入直至人工恢复为可审核状态。  
- **回写**：成功后 `updateDiscoveryItemImportResult` 将对应项设为 `status: "imported"` 并写入 `projectSlug`。

---

## 3. 当前系统数据流

**用工程语言概括**：Demo 或后续脚本构造 `DiscoveryItem`，经 store 持久化到 JSON；运营在 Admin 调整状态后发起 Import；服务端在校验、查重后 `prisma.project.create`（或命中既有行），再原子回写 JSON 并刷新相关页面缓存。

```text
GitHub repo URL（Demo 脚本内常量或可扩展为参数）
        │
        ▼
createDiscoveryItem / appendDiscoveryItem
        │
        ▼
data/discovery-items.json（JSON Array，URL 规范化去重）
        │
        ▼
/admin/discovery/items（readDiscoveryItems → 表格展示）
        │
        ├── 状态：Reviewed / Reject / Mark new
        │
        └── Import ──► importDiscoveryItemAction
                          │
                          ├── readDiscoveryItemById
                          ├── importJsonDiscoveryItem（DB 查重 + create 或命中）
                          ├── updateDiscoveryItemImportResult（imported + projectSlug）
                          └── revalidatePath（队列页、项目相关路径）
```

---

## 4. 关键文件与职责

| 文件路径 | 职责 | 当前定位 |
|----------|------|----------|
| `agents/discovery/discovery-types.ts` | `DiscoveryItem` / `DiscoveryStatus` / `DiscoverySourceType` 类型定义 | JSON 队列与脚本、Admin 的契约层 |
| `agents/discovery/discovery-store.ts` | `read*` / `append*` / `updateDiscoveryStatus` / `updateDiscoveryItemImportResult`；URL 规范化与排序 | 本地队列唯一持久化门面 |
| `agents/discovery/discovery-agent.ts` | `createDiscoveryItem` 等封装构造与入队 | 供脚本或未来 Agent 复用 |
| `scripts/run-discovery-github-demo.ts` | 无 API 依赖的入队示例 | 本地/CI 可复现的发现入口 Demo |
| `app/admin/discovery/items/page.tsx` | JSON 队列 Server Page | Admin 入口 |
| `app/admin/discovery/items/actions.ts` | 状态机 Server Actions + `importDiscoveryItemAction` | 鉴权、调用 import、revalidate |
| `app/admin/discovery/items/discovery-json-queue-table.tsx` | 客户端表格、操作按钮、导入反馈与链接 | 运营交互层 |
| `lib/discovery/import-json-queue-item.ts` | `importJsonDiscoveryItem`：解析 URL、查重、`project.create` | JSON 队列 → Prisma Project 的桥接层 |
| `data/discovery-items.json` | 队列数据文件 | 环境相关状态；仓库内可为空数组或含示例行 |

**相关索引（非本文件表格强制项，便于衔接）**：

- [Discovery 架构与数据流](./discovery/discovery-architecture.md)  
- [来源与去重](./discovery/discovery-sources.md)  
- [路线图：Prisma 候选池阶段总结](./roadmap/discovery-v2-summary.md)（侧重 **DiscoveryCandidate** 任务线，与本 JSON 队列 **互补阅读**）

---

## 5. 本阶段设计取舍

### 5.1 为什么先用 JSON Queue

- **成本**：文件 I/O + 轻量校验即可闭环，无需新表、迁移与双写同步。  
- **改动面**：与现有 DiscoveryCandidate 代码路径解耦，避免「一阶段改全盘」。  
- **验证速度**：团队可先在 Admin 上跑通心理模型与 Import 质量，再决定合流策略。  
- **冲突控制**：明确 **不覆盖** Prisma discovery 主链，仅为「最小闭环」服务。

### 5.2 为什么先只做 GitHub Demo

- GitHub 是当前 MUHUB 项目生态中最直观、最可分享的公开入口。  
- Demo 无需 Token、配额与 Webhook，工程依赖最少。  
- 避免在来源爆发前引入过多外部失败面（Rate limit、反爬、字段差异）。

### 5.3 为什么先打通 Import，再扩展来源

若缺少 **Import**，发现产物无法进入 **Project** 主数据，后续内容智能体、广场、增长归因均缺少稳定锚点。  
**先证明「能入库、可幂等、可运营」**，再扩展 RSS/API/定时任务，投资回报率更高。

### 5.4 为什么保留双轨

- **轨 A**：Prisma **`DiscoveryCandidate`** — 多来源、审核优先级、与 `approveDiscoveryCandidateImport` 深度集成。  
- **轨 B**：**JSON Queue** — 轻量、文件型、Import 直达 `Project`。  

这是 **阶段性并存**，不是声明「最终架构即双轨」。目的是：**降低改造风险**、允许并行试验，再在 V3 明确合流或下沉存储策略。

---

## 6. 当前限制与已知问题

- **来源单一**：队列实际 Demo 路径为 GitHub URL；RSS、Twitter 等枚举未接真实抓取。  
- **元数据弱**：无 GitHub API，无 stars、语言、默认分支、License 等结构化字段。  
- **JSON 不宜作为最终主存储**：并发写入、审计、跨实例一致性、查询能力均弱于数据库。  
- **去重偏轻量**：队列侧重 URL 规范化；入库侧重 URL / 基础 slug / Gitee 源等保守匹配；难以覆盖「同项目多 URL 表示」全集。  
- **与 Prisma Candidate 未合流**：同一现实世界项目可能两侧分别出现，需运营或未来规则对齐；无自动双向同步。  
- **无自动发现与定时任务**：无 Trending/RSS 定时拉取、无队列自动刷新。  
- **Review 以人工为主**：无自动打分、无自动过审；`rejected` 需人工恢复才可 Import。

---

## 7. Discovery V2 的阶段成果判断

- **结论**：**Discovery V2（JSON Queue 线）已完成「基础闭环」**——具备 **轻量发现入口 → 人工审核状态 → 导入正式 Project → 队列回写 `imported`/`projectSlug`** 的端到端能力。  
- **意义**：在 AI 信息层上补齐了 **第一块可落地的「项目入库前通道」** 基础设施雏形；后续内容智能体可将「候选项目」从该通道或从 Prisma 候选池获得更结构化的锚点。  
- **边界**（需克制表述）：当前实现 **不等于**「自动化发现系统」或「多源爬虫平台」；**属于受控、人工参与的基础版**，自动化与统一治理尚在后续阶段。

---

## 8. 下一阶段：Discovery V3 方向（建议）

以下方向用于 **自然衔接** 规划，不构成已承诺需求清单。

1. **RSS Discovery**：定向订阅与规范化条目落库，与去重策略对齐。  
2. **GitHub API 元数据增强**：stars、topics、description、pushedAt 等进入候选或队列扩展字段。  
3. **GitHub Trending / Topic Discovery**：规则化批量入口 + 频控与去重。  
4. **定时发现任务**：队列膨胀、运行记录、失败重试与运营可观测性。  
5. **去重与规范化升级**：同构 URL、重定向、镜像站、多域名官网的统一标识（需在 **尽量减少 schema 动荡** 前提下迭代）。  
6. **JSON Queue 与 Prisma Candidate 合流策略**：单一写入面、或 JSON 仅作边缘缓冲 + DB 为 SoR（System of Record）等选项评估。  
7. **内容智能体输入契约**：为后续 Agent 提供稳定、版本化的「发现事件」或「候选快照」接口（可与现有内容管线文档对齐）。

---

## 9. 结论

Discovery V2 / V2.1 的核心价值在于 **从 0 到 1** 跑通 **「发现 → 审核 → 入库」**，使 MUHUB 在 **AI 信息层** 获得可依赖的 **项目输入管道雏形**，并与既有 **DiscoveryCandidate** 运营养成 **清晰分工、可演进合流** 的关系。  
后续工作应在此骨架上 **扩展来源、增强元数据、提升自动化与统一发现体系**，而非在未验证闭环前堆叠复杂抓取逻辑。

---

## 附录：后续建议任务列表（轻量）

| 优先级 | 建议任务 | 备注 |
|--------|----------|------|
| P1 | GitHub API 只读 enrich（配额内） | 与 `import-json-queue-item` 或 Candidate 线共享规范化 |
| P1 | 合流策略技术评审 | 明确 SoR、迁移路径与运营流程 |
| P2 | RSS MVP | 单源或少源、强日志 |
| P2 | 定时任务框架 | 与现有 cron/脚本体系对齐 |
| P3 | JSON 队列写入并发保护 | 若长期保留文件存储则考虑锁或迁 DB |

---

**文档维护**：当 `DiscoveryItem` 字段、Import 规则或路由变更时，请同步更新本节与「关键文件」表。
