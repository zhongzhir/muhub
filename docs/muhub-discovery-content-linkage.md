# MUHUB Discovery × Content Intelligence 联动说明

> **文档性质**：模块联动说明（内部工程文档）。  
> **适用范围**：当前仓库中已落地的 Discovery V2/V2.1/V2.2 与 Content Intelligence V1 的实际联动链路。

## 1. 文档目的

本文用于沉淀当前 MUHUB 中 Discovery 与内容智能体的联动机制，重点回答以下问题：

- 当前链路如何触发、在哪些条件下触发
- 为什么按当前方式设计（而非更复杂自动化）
- 当前边界与限制是什么
- 后续 Discovery V3 / Content V1.5/V2 / 自动更新系统应如何衔接

该文档用于后续开发衔接与新会话复用，避免反复解释“Discovery 导入后为何会自动跑内容智能体”。

## 2. 当前联动链路概览

当前链路已打通为：

**Discovery Queue → Import Project → `scheduleProjectAiEnrichment` → Content Intelligence V1 → 项目内容补全**

对应工程流程可简化为：

```text
GitHub repo URL（当前以 demo 输入为主）
  → JSON Discovery Queue（data/discovery-items.json）
  → Admin Import（/admin/discovery/items）
  → Project.create（仅新建时）
  → scheduleProjectAiEnrichment(slug)
  → enrichProjectWithAi(slug)
  → 写回 Project 内容字段（如 description / tags，受条件约束）
```

## 3. 当前触发机制

### 3.1 触发时机

- 触发点位于 `DiscoveryItem` 导入流程中，且在 `Project.create` 成功之后
- 不在 `DiscoveryItem` 创建时触发
- 不在状态变为 `reviewed` 时触发

### 3.2 触发条件

- 仅当 Import 实际产生“**新建 Project**”时触发 AI 调度
- 若导入阶段命中既有项目（去重命中），仅回写 `imported` / `projectSlug`，不触发 AI
- 若 `DiscoveryItem.status === imported` 且已有有效 `projectSlug`，不重复触发

### 3.3 调用方式

- 当前调用为：`scheduleProjectAiEnrichment(project.slug)`
- 使用 `slug` 而不是 `id`
- 原因：现有公共 API 签名即 `scheduleProjectAiEnrichment(slug)`，遵循最小改动原则

## 4. 当前这样设计的原因

### 4.1 为什么挂在 Import 后面

- Discovery 的目标不只是收集候选项，而是把候选项转为正式 `Project`
- 内容智能体处理对象应是正式项目数据（具备稳定主键/可展示页面/可被后续系统复用），而非临时队列项

### 4.2 为什么只在新建时触发

- 避免重复计算与重复 AI 成本
- 防止后台重复点击 Import 导致重复调度
- 保持当前链路可控，先确保“首次导入补全”可靠

### 4.3 为什么 AI 失败不影响 Import

- Import 是主链路（项目入库）
- AI enrich 是后处理（补全）
- 不能因 AI 服务波动阻断主数据写入
- 实现上采用非阻塞调度 + 错误捕获，Import 成功优先

### 4.4 为什么需要对白名单补充 `discovery-json-queue`

- `enrichProjectWithAi` 对 `sourceType` 有准入判断
- 若不将 `discovery-json-queue` 纳入白名单，即使调度发生，实际 enrich 逻辑会被提前跳过
- 因此该白名单补充是 V2.2 联动生效的必要兼容改动

## 5. 当前涉及的关键文件

| 文件路径 | 职责 | 与联动关系 |
|---|---|---|
| `lib/discovery/import-json-queue-item.ts` | JSON 队列项导入 Project（查重、创建、返回 slug） | 在 `Project.create` 成功后触发 `scheduleProjectAiEnrichment(project.slug)`，并记录日志 |
| `lib/ai/enrich-project.ts` | 内容补全主逻辑（`enrichProjectWithAi`）与调度入口（`scheduleProjectAiEnrichment`） | 提供异步调度与 sourceType 准入；V2.2 将 `discovery-json-queue` 纳入白名单 |
| `app/admin/discovery/items/actions.ts` | Admin 导入动作与回写 | 通过 `importDiscoveryItemAction` 调用导入逻辑，联动触发发生在该调用链内部 |
| `agents/discovery/discovery-store.ts` | JSON 队列读写与状态回写 | 管理 `status` / `projectSlug`，决定导入后的幂等行为入口条件 |
| `docs/muhub-discovery-v2-phase-summary.md` | Discovery V2/V2.1 阶段归档 | 提供联动链路前置背景（Queue、Review、Import 的阶段结论） |
| `docs/muhub-content-intelligence-v1.md` | Content Intelligence V1 说明 | 提供补全逻辑与输出边界背景（联动后的执行目标） |

## 6. 当前边界与限制

### 6.1 当前触发仍然偏“单次导入驱动”

- 仅在“Import 且新建项目”时触发一次
- 不是持续更新机制

### 6.2 当前没有显式 enrich 状态跟踪

- 后台暂无专门字段展示“已调度 / 成功 / 失败 / 最近执行时间”
- 当前主要依赖日志与结果字段侧面观察

### 6.3 当前不支持重复手动重跑联动

- 对同一项目的再次内容补全不由本链路直接提供
- 需依赖其它现有入口或后续新增能力

### 6.4 当前内容补全效果依赖 AI 与数据条件

- 调度成功不等于一定产出完整内容
- 结果受现有 enrich 规则、字段空值条件、AI 配置与数据库状态影响

### 6.5 当前 Discovery 来源仍然有限

- 该联动当前主要服务于 JSON Queue / GitHub demo 导入链路
- 尚未覆盖全来源自动发现体系

## 7. 后续扩展方向

- 增加后台可见的 enrich 状态（调度时间、执行结果、最近错误）
- 支持对单项目手动重新触发内容智能体
- 支持定时更新 / 增量 enrich（从“一次导入触发”走向“持续维护”）
- 将 RSS / GitHub API / Trending 等来源接入同一联动链路
- 统一 `DiscoveryCandidate` 与 JSON Queue 的触发模型
- 让内容智能体输出更结构化字段，减少后续内容生产与审核摩擦

## 8. 结论

当前 MUHUB 已实现“**发现 → 导入 → 内容补全**”的基础自动化链路：Discovery 队列项在新建导入成功后可自动触发 Content Intelligence V1。  
这标志着 AI 信息层从“模块能力”进入“跨模块联动”阶段。与此同时，系统仍处于基础版：后续重点应放在可观测性、可重跑性、来源扩展与统一触发体系，而不是过早宣称为全自动发现平台。

---

## 相关文档（相对路径）

- `./muhub-discovery-v2-phase-summary.md`
- `./muhub-content-intelligence-v1.md`
- `./discovery/discovery-architecture.md`
